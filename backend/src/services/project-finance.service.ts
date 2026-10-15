import { Prisma } from '@prisma/client';
import type {
  AuthUser,
  CreateProjectExpenseInput,
  ProjectFinance,
  ReviseProjectBudgetInput,
} from '@somwave/shared';
import { holdsPermission, PERMISSIONS } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { projectManageScope, projectScope } from './project.service';

const zero = new Prisma.Decimal(0);
function canRead(actor: AuthUser): boolean {
  return (
    actor.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') ||
    holdsPermission(actor, PERMISSIONS.INVOICES_READ)
  );
}
function canWrite(actor: AuthUser): boolean {
  return (
    actor.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') ||
    holdsPermission(actor, PERMISSIONS.INVOICES_UPDATE)
  );
}
async function requireProject(projectId: string, actor: AuthUser, write: boolean) {
  if (write ? !canWrite(actor) : !canRead(actor))
    throw new AppError('FORBIDDEN', 403, 'Financial access required');
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      ...(write ? projectManageScope(actor) : projectScope(actor)),
    },
    select: { id: true, budget: true },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  return project;
}

export async function getProjectFinance(
  projectId: string,
  actor: AuthUser,
): Promise<ProjectFinance> {
  const project = await requireProject(projectId, actor, false);
  const [expenses, revisions] = await Promise.all([
    prisma.projectExpense.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.projectBudgetRevision.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
  ]);
  const categories = new Map<string, { planned: Prisma.Decimal; actual: Prisma.Decimal }>();
  let planned = zero;
  let actual = zero;
  for (const expense of expenses) {
    const category = categories.get(expense.category) ?? { planned: zero, actual: zero };
    if (expense.kind === 'PLANNED') {
      planned = planned.plus(expense.amount);
      category.planned = category.planned.plus(expense.amount);
    } else {
      actual = actual.plus(expense.amount);
      category.actual = category.actual.plus(expense.amount);
    }
    categories.set(expense.category, category);
  }
  const originalBudget = revisions.length
    ? revisions[revisions.length - 1]!.previousBudget
    : project.budget;
  return {
    originalBudget: originalBudget?.toString() ?? null,
    currentBudget: project.budget?.toString() ?? null,
    plannedExpenses: planned.toString(),
    actualExpenses: actual.toString(),
    utilizationPercent: project.budget?.greaterThan(0)
      ? Number(actual.div(project.budget).times(100).toDecimalPlaces(1).toString())
      : null,
    categories: [...categories.entries()]
      .map(([category, amounts]) => ({
        category,
        planned: amounts.planned.toString(),
        actual: amounts.actual.toString(),
      }))
      .sort((a, b) => a.category.localeCompare(b.category)),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      kind: expense.kind,
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      expenseDate: expense.expenseDate?.toISOString() ?? null,
      actorId: expense.actorId,
      createdAt: expense.createdAt.toISOString(),
    })),
    revisions: revisions.map((revision) => ({
      id: revision.id,
      previousBudget: revision.previousBudget?.toString() ?? null,
      newBudget: revision.newBudget.toString(),
      reason: revision.reason,
      actorId: revision.actorId,
      createdAt: revision.createdAt.toISOString(),
    })),
  };
}

export async function createProjectExpense(
  projectId: string,
  actor: AuthUser,
  input: CreateProjectExpenseInput,
) {
  await requireProject(projectId, actor, true);
  return prisma.$transaction(async (tx) => {
    const expense = await tx.projectExpense.create({
      data: {
        projectId,
        kind: input.kind,
        category: input.category,
        description: input.description,
        amount: new Prisma.Decimal(input.amount),
        expenseDate: input.expenseDate ? new Date(input.expenseDate) : null,
        actorId: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'project.expense.create',
        subjectType: 'ProjectExpense',
        subjectId: expense.id,
        after: {
          projectId,
          kind: expense.kind,
          category: expense.category,
          amount: expense.amount.toString(),
        },
      },
    });
    return { id: expense.id };
  });
}

export async function removeProjectExpense(projectId: string, expenseId: string, actor: AuthUser) {
  await requireProject(projectId, actor, true);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.projectExpense.updateMany({
      where: { id: expenseId, projectId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!claimed.count) throw new AppError('NOT_FOUND', 404, 'Expense not found');
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'project.expense.remove',
        subjectType: 'ProjectExpense',
        subjectId: expenseId,
        after: { projectId },
      },
    });
  });
  return { success: true };
}

export async function reviseProjectBudget(
  projectId: string,
  actor: AuthUser,
  input: ReviseProjectBudgetInput,
) {
  const project = await requireProject(projectId, actor, true);
  const nextBudget = new Prisma.Decimal(input.budget);
  if (project.budget?.equals(nextBudget))
    throw new AppError('CONFLICT', 409, 'Budget has not changed');
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.project.updateMany({
      where: { id: projectId, deletedAt: null, budget: project.budget },
      data: { budget: nextBudget },
    });
    if (!claimed.count)
      throw new AppError('CONFLICT', 409, 'Budget changed; refresh and try again');
    const revision = await tx.projectBudgetRevision.create({
      data: {
        projectId,
        previousBudget: project.budget,
        newBudget: nextBudget,
        reason: input.reason,
        actorId: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'project.budget.revise',
        subjectType: 'Project',
        subjectId: projectId,
        before: { budget: project.budget?.toString() ?? null },
        after: { budget: nextBudget.toString(), reason: input.reason },
      },
    });
    return { id: revision.id, budget: nextBudget.toString() };
  });
}
