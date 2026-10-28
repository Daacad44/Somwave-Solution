// Project money read model (I8.B interim). Loads every money record that is
// linked to a project — invoices, payments, project expenses, finance
// transactions, budgets and logged time — and hands them to the pure
// aggregation in project-money.calc.ts. Read-only: nothing here writes.
//
// Visibility: routes sit behind the finance router (finance.read + 2FA step-up),
// and finance readers see every project.
import type {
  ProjectMoneyCategory,
  ProjectMoneyDetail,
  ProjectMoneyOverview,
  ProjectMoneyQuery,
  ProjectMoneyRow,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { AppError } from '../lib/http';
import {
  ZERO,
  addFigures,
  ageing,
  businessMonth,
  computeFigures,
  daysOverdue,
  emptyFigures,
  expenseCountsAsSpent,
  findDuplicates,
  groupBy,
  health,
  invoiceOutstanding,
  lastMonths,
  money,
  monthlySeries,
  serializeFigures,
  transactionCounts,
  type Decimal,
  type MoneyExpense,
  type MoneyInvoice,
  type MoneyPayment,
  type MoneyTransaction,
} from './project-money.calc';

const TX_STATUSES = ['SUBMITTED', 'APPROVED', 'POSTED'] as const;
const OVERVIEW_MONTHS = 12;

function baseNotes(currency: string): string[] {
  return [
    `Figures come from invoices, payments, project expenses, posted finance transactions and logged time, including records created before the ledger existed. Amounts are in ${currency}.`,
    'Spent = actual project expenses + posted expense transactions. Pending approvals are shown separately and are not counted as spent.',
    'Profit here is project-level (money in minus money out). It excludes labour cost until engineer cost rates exist.',
  ];
}

interface Loaded {
  invoices: MoneyInvoice[];
  payments: MoneyPayment[];
  expenses: MoneyExpense[];
  transactions: MoneyTransaction[];
}

async function loadMoney(projectId?: string): Promise<Loaded> {
  const projectFilter = projectId ? { projectId } : {};
  const [invoices, payments, expenses, transactions] = await Promise.all([
    prisma.invoice.findMany({
      where: { deletedAt: null, ...projectFilter },
      select: {
        id: true,
        number: true,
        projectId: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        paidAmount: true,
      },
      orderBy: { issueDate: 'desc' },
    }),
    prisma.payment.findMany({
      where: {
        deletedAt: null,
        invoice: { deletedAt: null, ...(projectId ? { projectId } : {}) },
      },
      select: {
        id: true,
        invoiceId: true,
        amount: true,
        method: true,
        status: true,
        reference: true,
        createdAt: true,
        invoice: { select: { number: true, projectId: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.projectExpense.findMany({
      where: { deletedAt: null, ...projectFilter },
      select: {
        id: true,
        projectId: true,
        kind: true,
        category: true,
        description: true,
        amount: true,
        expenseDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.financeTransaction.findMany({
      where: {
        status: { in: [...TX_STATUSES] },
        ...(projectId ? { projectId } : { projectId: { not: null } }),
      },
      select: {
        id: true,
        projectId: true,
        type: true,
        status: true,
        category: true,
        description: true,
        amount: true,
        currency: true,
        occurredOn: true,
        counterparty: true,
        createdById: true,
        reviewedById: true,
        reviewReason: true,
        paymentMethod: true,
        externalRef: true,
      },
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);
  return {
    invoices,
    payments: payments.map((row) => ({
      id: row.id,
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoice.number,
      projectId: row.invoice.projectId,
      amount: row.amount,
      method: row.method,
      status: row.status,
      reference: row.reference,
      date: row.createdAt,
    })),
    expenses: expenses.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      kind: row.kind,
      category: row.category,
      description: row.description,
      amount: row.amount,
      date: row.expenseDate ?? row.createdAt,
    })),
    transactions: transactions.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      type: row.type,
      status: row.status,
      category: row.category,
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      date: row.occurredOn,
      counterparty: row.counterparty,
      createdById: row.createdById,
      reviewedById: row.reviewedById,
      reviewReason: row.reviewReason,
      paymentMethod: row.paymentMethod,
      externalRef: row.externalRef,
    })),
  };
}

async function minutesByProject(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ projectId: string; minutes: bigint | number }[]>`
    SELECT t."project_id" AS "projectId", COALESCE(SUM(e."minutes"), 0) AS "minutes"
    FROM "task_time_entries" e
    JOIN "tasks" t ON t."id" = e."task_id"
    WHERE t."deleted_at" IS NULL
    GROUP BY t."project_id"`;
  return new Map(rows.map((row) => [row.projectId, Number(row.minutes)]));
}

function otherCurrencyNote(transactions: readonly MoneyTransaction[], currency: string): string[] {
  const others = new Set(
    transactions.filter((tx) => tx.currency !== currency).map((tx) => tx.currency),
  );
  if (!others.size) return [];
  return [
    `Transactions in ${[...others].sort().join(', ')} are listed on each project but not added to ${currency} totals (no exchange rate is applied).`,
  ];
}

function sortRows(rows: ProjectMoneyRow[], query: ProjectMoneyQuery): ProjectMoneyRow[] {
  const sign = query.direction === 'asc' ? 1 : -1;
  const numeric = (value: string | null): number => (value === null ? -Infinity : Number(value));
  const pick: Record<ProjectMoneyQuery['sort'], (row: ProjectMoneyRow) => number | string> = {
    name: (row) => row.projectName.toLowerCase(),
    budget: (row) => numeric(row.budget),
    invoiced: (row) => numeric(row.invoiced),
    collected: (row) => numeric(row.collected),
    outstanding: (row) => numeric(row.outstanding),
    spent: (row) => numeric(row.spent),
    profit: (row) => numeric(row.cashProfit),
    budgetUsed: (row) => numeric(row.budgetUsedPercent),
  };
  const key = pick[query.sort];
  return [...rows].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left < right) return -1 * sign;
    if (left > right) return 1 * sign;
    return a.projectName.localeCompare(b.projectName);
  });
}

export async function projectMoneyOverview(
  query: ProjectMoneyQuery,
  now: Date = new Date(),
): Promise<ProjectMoneyOverview> {
  const currency = env.FINANCE_BASE_CURRENCY;
  const [projects, loaded, minutes] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        budget: true,
        clientId: true,
        client: { select: { companyName: true } },
      },
      orderBy: { name: 'asc' },
    }),
    loadMoney(),
    minutesByProject(),
  ]);
  const invoicesBy = groupBy(loaded.invoices, (row) => row.projectId);
  const paymentsBy = groupBy(loaded.payments, (row) => row.projectId);
  const expensesBy = groupBy(loaded.expenses, (row) => row.projectId);
  const txBy = groupBy(loaded.transactions, (row) => row.projectId);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  let totals = emptyFigures();
  const rows: ProjectMoneyRow[] = projects.map((project) => {
    const figures = computeFigures({
      budget: project.budget,
      invoices: invoicesBy.get(project.id) ?? [],
      payments: paymentsBy.get(project.id) ?? [],
      expenses: expensesBy.get(project.id) ?? [],
      transactions: txBy.get(project.id) ?? [],
      minutes: minutes.get(project.id) ?? 0,
      currency,
      now,
    });
    totals = addFigures(totals, figures);
    return {
      projectId: project.id,
      projectName: project.name,
      status: project.status,
      clientId: project.clientId,
      clientName: project.client?.companyName ?? null,
      health: health(figures.spent, project.budget),
      invoiceCount: figures.invoiceCount,
      overdueInvoiceCount: figures.overdueInvoiceCount,
      ...serializeFigures(figures),
    };
  });

  // Client-level invoices with no project still belong in company totals.
  const unassigned = computeFigures({
    budget: null,
    invoices: loaded.invoices.filter((row) => row.projectId === null),
    payments: loaded.payments.filter((row) => row.projectId === null),
    expenses: [],
    transactions: [],
    minutes: 0,
    currency,
    now,
  });
  totals = addFigures(totals, unassigned);

  const categories = new Map<
    string,
    { planned: Decimal; spent: Decimal; projects: Map<string, Decimal> }
  >();
  const touch = (category: string) => {
    const entry = categories.get(category) ?? { planned: ZERO, spent: ZERO, projects: new Map() };
    categories.set(category, entry);
    return entry;
  };
  for (const expense of loaded.expenses) {
    const entry = touch(expense.category);
    if (expense.kind === 'PLANNED') {
      entry.planned = entry.planned.add(expense.amount);
      continue;
    }
    entry.spent = entry.spent.add(expense.amount);
    entry.projects.set(
      expense.projectId,
      (entry.projects.get(expense.projectId) ?? ZERO).add(expense.amount),
    );
  }
  for (const tx of loaded.transactions) {
    if (tx.type !== 'EXPENSE' || !tx.projectId || !transactionCounts(tx, currency)) continue;
    const entry = touch(tx.category);
    entry.spent = entry.spent.add(tx.amount);
    entry.projects.set(tx.projectId, (entry.projects.get(tx.projectId) ?? ZERO).add(tx.amount));
  }
  const categoryRows: ProjectMoneyCategory[] = [...categories.entries()]
    .map(([category, entry]) => ({
      category,
      planned: money(entry.planned),
      spent: money(entry.spent),
      projects: [...entry.projects.entries()]
        .map(([projectId, amount]) => ({
          projectId,
          projectName: projectNames.get(projectId) ?? 'Unknown project',
          spent: money(amount),
        }))
        .sort((a, b) => Number(b.spent) - Number(a.spent)),
    }))
    .sort((a, b) => Number(b.spent) - Number(a.spent) || a.category.localeCompare(b.category));

  const duplicates = findDuplicates(loaded.expenses, loaded.transactions);
  const notes = [...baseNotes(currency), ...otherCurrencyNote(loaded.transactions, currency)];
  if (duplicates.size) {
    notes.push(
      `${duplicates.size} posted expense transaction(s) match an actual project expense (same project, amount and date). Open the project to review possible double entry.`,
    );
  }

  const search = query.search?.toLowerCase();
  const filtered = rows.filter(
    (row) =>
      (!query.status || row.status === query.status) &&
      (!query.health || row.health === query.health) &&
      (!search ||
        row.projectName.toLowerCase().includes(search) ||
        (row.clientName?.toLowerCase().includes(search) ?? false)),
  );

  return {
    currency,
    generatedAt: now.toISOString(),
    totals: {
      ...serializeFigures(totals),
      projectCount: rows.length,
      projectsOverBudget: rows.filter((row) => row.health === 'OVER_BUDGET').length,
      projectsAtRisk: rows.filter((row) => row.health === 'AT_RISK').length,
      projectsWithOverdue: rows.filter((row) => row.overdueInvoiceCount > 0).length,
      unassigned: {
        invoiced: money(unassigned.invoiced),
        collected: money(unassigned.collected),
        outstanding: money(unassigned.outstanding),
      },
    },
    projects: sortRows(filtered, query),
    categories: categoryRows,
    months: monthlySeries({ ...loaded, currency }, lastMonths(now, OVERVIEW_MONTHS)),
    ageing: ageing(loaded.invoices, now),
    notes,
  };
}

function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  let [year, month] = first.split('-').map(Number) as [number, number];
  const [endYear, endMonth] = last.split('-').map(Number) as [number, number];
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

export async function projectMoneyDetail(
  projectId: string,
  now: Date = new Date(),
): Promise<ProjectMoneyDetail> {
  const currency = env.FINANCE_BASE_CURRENCY;
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      budget: true,
      startDate: true,
      dueDate: true,
      clientId: true,
      createdAt: true,
      client: { select: { companyName: true } },
      manager: { select: { name: true } },
    },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

  const [loaded, revisions, byPerson, byPhase, members] = await Promise.all([
    loadMoney(projectId),
    prisma.projectBudgetRevision.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.$queryRaw<{ userId: string; name: string; minutes: bigint | number }[]>`
      SELECT u."id" AS "userId", u."name" AS "name", COALESCE(SUM(e."minutes"), 0) AS "minutes"
      FROM "task_time_entries" e
      JOIN "tasks" t ON t."id" = e."task_id"
      JOIN "users" u ON u."id" = e."user_id"
      WHERE t."project_id" = ${projectId} AND t."deleted_at" IS NULL
      GROUP BY u."id", u."name"
      ORDER BY 3 DESC`,
    prisma.$queryRaw<{ phaseId: string | null; title: string | null; minutes: bigint | number }[]>`
      SELECT ph."id" AS "phaseId", ph."title" AS "title", COALESCE(SUM(e."minutes"), 0) AS "minutes"
      FROM "task_time_entries" e
      JOIN "tasks" t ON t."id" = e."task_id"
      LEFT JOIN "project_phases" ph ON ph."id" = t."phase_id" AND ph."deleted_at" IS NULL
      WHERE t."project_id" = ${projectId} AND t."deleted_at" IS NULL
      GROUP BY ph."id", ph."title"
      ORDER BY 3 DESC`,
    prisma.projectMember.findMany({
      where: { projectId, removedAt: null },
      select: { userId: true, role: true, user: { select: { name: true } } },
      orderBy: { assignedAt: 'asc' },
    }),
  ]);
  const totalMinutes = byPerson.reduce((sum, row) => sum + Number(row.minutes), 0);
  const figures = computeFigures({
    budget: project.budget,
    ...loaded,
    minutes: totalMinutes,
    currency,
    now,
  });
  const duplicates = findDuplicates(loaded.expenses, loaded.transactions);

  const categories = new Map<string, { planned: Decimal; spent: Decimal }>();
  const bump = (category: string, key: 'planned' | 'spent', amount: Decimal) => {
    const entry = categories.get(category) ?? { planned: ZERO, spent: ZERO };
    entry[key] = entry[key].add(amount);
    categories.set(category, entry);
  };
  for (const expense of loaded.expenses) {
    bump(expense.category, expense.kind === 'PLANNED' ? 'planned' : 'spent', expense.amount);
  }
  for (const tx of loaded.transactions) {
    if (tx.type === 'EXPENSE' && transactionCounts(tx, currency))
      bump(tx.category, 'spent', tx.amount);
  }

  const spending = [
    ...loaded.expenses.map((expense) => ({
      id: expense.id,
      source: 'PROJECT_EXPENSE' as const,
      state: expense.kind,
      category: expense.category,
      description: expense.description,
      amount: money(expense.amount),
      currency,
      date: expense.date.toISOString(),
      counterparty: null,
      countsAsSpent: expenseCountsAsSpent(expense),
      possibleDuplicateOf: null,
      createdById: null,
      reviewedById: null,
      reviewReason: null,
      paymentMethod: null,
      reference: null,
    })),
    ...loaded.transactions
      .filter((tx) => tx.type === 'EXPENSE')
      .map((tx) => ({
        id: tx.id,
        source: 'FINANCE_TRANSACTION' as const,
        state: tx.status,
        category: tx.category,
        description: tx.description,
        amount: money(tx.amount),
        currency: tx.currency,
        date: tx.date.toISOString(),
        counterparty: tx.counterparty,
        countsAsSpent: transactionCounts(tx, currency),
        possibleDuplicateOf: duplicates.get(tx.id) ?? null,
        createdById: tx.createdById ?? null,
        reviewedById: tx.reviewedById ?? null,
        reviewReason: tx.reviewReason ?? null,
        paymentMethod: tx.paymentMethod ?? null,
        reference: tx.externalRef ?? null,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const firstDate = [
    project.startDate,
    project.createdAt,
    ...loaded.invoices.map((row) => row.issueDate),
    ...loaded.payments.map((row) => row.date),
    ...loaded.expenses.filter(expenseCountsAsSpent).map((row) => row.date),
    ...loaded.transactions.map((row) => row.date),
  ]
    .filter((date): date is Date => date instanceof Date)
    .reduce((min, date) => (date < min ? date : min), now);
  const series = monthlySeries(
    { ...loaded, currency },
    monthsBetween(businessMonth(firstDate), businessMonth(now)),
  );
  let runningIn = ZERO;
  let runningOut = ZERO;
  const timeline = series.map((row) => {
    runningIn = runningIn.add(row.moneyIn);
    runningOut = runningOut.add(row.moneyOut);
    return {
      month: row.month,
      moneyIn: row.moneyIn,
      moneyOut: row.moneyOut,
      cumulativeIn: money(runningIn),
      cumulativeOut: money(runningOut),
    };
  });

  const notes = [...baseNotes(currency), ...otherCurrencyNote(loaded.transactions, currency)];
  if (duplicates.size) {
    notes.push(
      `${duplicates.size} posted expense transaction(s) may duplicate an actual project expense. They are marked in Spending; both are counted until one is removed or reversed.`,
    );
  }

  return {
    currency,
    generatedAt: now.toISOString(),
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      clientId: project.clientId,
      clientName: project.client?.companyName ?? null,
      managerName: project.manager?.name ?? null,
      startDate: project.startDate?.toISOString() ?? null,
      dueDate: project.dueDate?.toISOString() ?? null,
    },
    figures: serializeFigures(figures),
    health: health(figures.spent, project.budget),
    invoices: loaded.invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      total: money(invoice.total),
      paid: money(invoice.paidAmount),
      outstanding: money(invoiceOutstanding(invoice)),
      daysOverdue: daysOverdue(invoice, now),
    })),
    payments: loaded.payments.map((payment) => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      invoiceNumber: payment.invoiceNumber,
      amount: money(payment.amount),
      method: payment.method,
      status: payment.status,
      reference: payment.reference,
      date: payment.date.toISOString(),
    })),
    spending,
    otherIncome: loaded.transactions
      .filter((tx) => tx.type === 'INCOME')
      .map((tx) => ({
        id: tx.id,
        status: tx.status,
        category: tx.category,
        description: tx.description,
        amount: money(tx.amount),
        currency: tx.currency,
        date: tx.date.toISOString(),
        counterparty: tx.counterparty,
      })),
    categories: [...categories.entries()]
      .map(([category, entry]) => ({
        category,
        planned: money(entry.planned),
        spent: money(entry.spent),
      }))
      .sort((a, b) => Number(b.spent) - Number(a.spent) || a.category.localeCompare(b.category)),
    budgetHistory: revisions.map((revision) => ({
      id: revision.id,
      previousBudget: revision.previousBudget ? money(revision.previousBudget) : null,
      newBudget: money(revision.newBudget),
      reason: revision.reason,
      date: revision.createdAt.toISOString(),
    })),
    members: members.map((row) => ({ userId: row.userId, name: row.user.name, role: row.role })),
    hoursByPerson: byPerson.map((row) => ({
      userId: row.userId,
      name: row.name,
      hours: (Number(row.minutes) / 60).toFixed(1),
    })),
    hoursByPhase: byPhase.map((row) => ({
      phaseId: row.phaseId,
      title: row.title ?? 'No phase',
      hours: (Number(row.minutes) / 60).toFixed(1),
    })),
    timeline,
    notes,
  };
}

export const __test = { monthsBetween, sortRows };
