// Projects service (I2.1). Only layer that touches Prisma (§5). Money is stored
// Decimal(12,2) and surfaced as a decimal string; dates as ISO 8601 (§7, §11).
import type {
  AdminMilestone,
  AdminProject,
  AdminTask,
  CreateProjectInput,
  ProjectHealth,
  ProjectHealthReason,
  ProjectStatus,
  ProjectWorkspace,
  TaskPriority,
  TaskStatus,
  UpdateProjectInput,
  AuthUser,
  UpdateProjectHealthNoteInput,
} from '@somwave/shared';
import { holdsPermission, MAX_PAGE_SIZE, PERMISSIONS } from '@somwave/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { correlationId } from '../lib/requestContext';
import { calculateWeeklyCapacity } from './engineering-capacity.service';

const adminProjectSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  dueDate: true,
  budget: true,
  clientId: true,
  createdAt: true,
  manager: { select: { id: true, name: true } },
} as const;

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  dueDate: Date | null;
  budget: Prisma.Decimal | null;
  clientId: string | null;
  createdAt: Date;
  manager: { id: string; name: string } | null;
};

function toAdminProject(row: ProjectRow): AdminProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.startDate?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    budget: row.budget?.toString() ?? null,
    clientId: row.clientId,
    manager: row.manager,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ListProjectsParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: ProjectStatus;
  actor?: AuthUser;
}

/** Administrative roles may manage the portfolio; other staff only see their projects. */
export function projectScope(actor?: AuthUser): Prisma.ProjectWhereInput {
  if (!actor || actor.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN')) return {};
  return {
    OR: [{ managerId: actor.id }, { members: { some: { userId: actor.id, removedAt: null } } }],
  };
}

/** Mutations require project ownership, an active manager membership, or administrator role. */
export function projectManageScope(actor: AuthUser): Prisma.ProjectWhereInput {
  if (actor.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN')) return {};
  return {
    OR: [
      { managerId: actor.id },
      { members: { some: { userId: actor.id, role: 'MANAGER', removedAt: null } } },
    ],
  };
}

export interface PagedProjects {
  items: AdminProject[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listProjects({
  page,
  pageSize,
  search,
  status,
  actor,
}: ListProjectsParams): Promise<PagedProjects> {
  const take = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const skip = (Math.max(page, 1) - 1) * take;

  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    ...projectScope(actor),
    ...(status ? { status } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      select: adminProjectSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.project.count({ where }),
  ]);

  return { items: rows.map(toAdminProject), page: Math.max(page, 1), pageSize: take, total };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Progress is null when the project has no tasks, so the UI does not invent 0%. */
export function deriveProgress(total: number, done: number): number | null {
  if (total <= 0) return null;
  return Math.round((done / total) * 100);
}

export function deriveProjectHealth(input: {
  status: ProjectStatus;
  dueDate: string | null;
  now?: Date;
}): ProjectHealth {
  return deriveProjectHealthDetails(input).health;
}

export function deriveProjectHealthDetails(input: {
  status: ProjectStatus;
  dueDate: string | null;
  overdueMilestones?: number;
  overdueTasks?: number;
  blockedTasks?: number;
  blockedDependencies?: number;
  constrainedEngineers?: number;
  remainingTasks?: number;
  now?: Date;
}): { health: ProjectHealth; reasons: ProjectHealthReason[] } {
  if (input.status === 'COMPLETED') return { health: 'COMPLETE', reasons: [] };
  if (input.status === 'CANCELLED') return { health: 'CANCELLED', reasons: [] };
  const reasons: ProjectHealthReason[] = [];
  const due = input.dueDate ? Date.parse(input.dueDate) : NaN;
  const remainingTasks = input.remainingTasks ?? 0;
  const now = (input.now ?? new Date()).getTime();
  const projectOverdue = Number.isFinite(due) && due < now;
  if (projectOverdue) reasons.push({ code: 'PROJECT_OVERDUE', count: 1 });
  if (input.overdueMilestones) {
    reasons.push({ code: 'MILESTONES_OVERDUE', count: input.overdueMilestones });
  }
  if (input.overdueTasks) reasons.push({ code: 'TASKS_OVERDUE', count: input.overdueTasks });
  if (input.blockedTasks) reasons.push({ code: 'TASKS_BLOCKED', count: input.blockedTasks });
  if (input.blockedDependencies) {
    reasons.push({ code: 'DEPENDENCIES_BLOCKED', count: input.blockedDependencies });
  }
  if (input.constrainedEngineers && remainingTasks > 0) {
    reasons.push({ code: 'CAPACITY_CONSTRAINED', count: input.constrainedEngineers });
  }
  if (input.status === 'ON_HOLD') reasons.push({ code: 'ON_HOLD', count: 1 });
  if (Number.isFinite(due) && !projectOverdue && due - now <= 7 * DAY_MS) {
    reasons.push({ code: 'DEADLINE_NEAR', count: 1 });
  }
  if (projectOverdue || input.overdueMilestones || input.overdueTasks) {
    return { health: 'OVERDUE', reasons };
  }
  if (reasons.length > 0) return { health: 'AT_RISK', reasons };
  return { health: Number.isFinite(due) ? 'ON_TRACK' : 'NO_DATE', reasons };
}

export async function getProject(id: string, actor?: AuthUser): Promise<AdminProject | null> {
  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null, ...projectScope(actor) },
    select: adminProjectSelect,
  });
  return row ? toAdminProject(row) : null;
}

// A managerId, when given, must belong to a real active user.
async function assertManagerExists(managerId: string | null | undefined): Promise<void> {
  if (!managerId) return;
  const manager = await prisma.user.findFirst({
    where: { id: managerId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!manager) throw new AppError('VALIDATION_ERROR', 400, 'Manager not found');
}

export async function createProject(input: CreateProjectInput): Promise<AdminProject> {
  await assertManagerExists(input.managerId);

  const row = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      budget: input.budget ? new Prisma.Decimal(input.budget) : null,
      clientId: input.clientId ?? null,
      managerId: input.managerId ?? null,
    },
    select: adminProjectSelect,
  });
  return toAdminProject(row);
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  actor?: AuthUser,
): Promise<AdminProject> {
  if (!actor) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null, ...projectManageScope(actor) },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

  if (input.managerId) await assertManagerExists(input.managerId);

  const row = await prisma.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined
        ? { startDate: input.startDate ? new Date(input.startDate) : null }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      ...(input.budget !== undefined
        ? { budget: input.budget ? new Prisma.Decimal(input.budget) : null }
        : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
    },
    select: adminProjectSelect,
  });
  return toAdminProject(row);
}

export async function updateProjectHealthNote(
  id: string,
  input: UpdateProjectHealthNoteInput,
  actor: AuthUser,
): Promise<{ note: string | null }> {
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null, ...projectManageScope(actor) },
    select: { id: true, healthNote: true },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  const note = input.note?.trim() || null;
  await prisma.$transaction(async (tx) => {
    const result = await tx.project.updateMany({
      where: { id, deletedAt: null, ...projectManageScope(actor) },
      data: { healthNote: note },
    });
    if (result.count === 0) throw new AppError('NOT_FOUND', 404, 'Project not found');
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'project.health_note.updated',
        subjectType: 'Project',
        subjectId: id,
        before: { note: project.healthNote },
        after: { note },
        correlationId: correlationId(),
      },
    });
  });
  return { note };
}

export async function getProjectWorkspace(
  id: string,
  scope: { actor: AuthUser } | { clientId: string },
): Promise<ProjectWorkspace | null> {
  const row = await prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
      ...('actor' in scope ? projectScope(scope.actor) : { clientId: scope.clientId }),
    },
    select: {
      ...adminProjectSelect,
      healthNote: true,
      client: { select: { companyName: true } },
    },
  });
  if (!row) return null;

  const canEditHealthNote =
    'actor' in scope &&
    holdsPermission(scope.actor, PERMISSIONS.PROJECTS_UPDATE) &&
    (scope.actor.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') ||
      row.manager?.id === scope.actor.id ||
      Boolean(
        await prisma.projectMember.findFirst({
          where: { projectId: id, userId: scope.actor.id, role: 'MANAGER', removedAt: null },
          select: { id: true },
        }),
      ));

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
  const openTaskWhere: Prisma.TaskWhereInput = {
    projectId: id,
    deletedAt: null,
    status: { notIn: ['DONE', 'CANCELLED'] },
  };
  const [
    tasks,
    milestones,
    total,
    done,
    cancelled,
    overdueTasks,
    blockedTasks,
    overdueMilestones,
    blockedDependencies,
    members,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.milestone.findMany({
      where: { projectId: id, deletedAt: null },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        completedAt: true,
        order: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.task.count({ where: { projectId: id, deletedAt: null } }),
    prisma.task.count({ where: { projectId: id, deletedAt: null, status: 'DONE' } }),
    prisma.task.count({ where: { projectId: id, deletedAt: null, status: 'CANCELLED' } }),
    prisma.task.count({ where: { ...openTaskWhere, dueDate: { lt: now } } }),
    prisma.task.count({ where: { ...openTaskWhere, status: 'BLOCKED' } }),
    prisma.milestone.count({
      where: { projectId: id, deletedAt: null, status: { not: 'COMPLETED' }, dueDate: { lt: now } },
    }),
    prisma.task.count({
      where: {
        ...openTaskWhere,
        dependencies: {
          some: { dependsOn: { deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } } },
        },
      },
    }),
    prisma.projectMember.findMany({
      where: { projectId: id, removedAt: null, role: 'ENGINEER' },
      select: {
        user: {
          select: {
            isActive: true,
            engineerProfile: {
              select: { status: true, availability: true, weeklyCapacityHours: true },
            },
            assignedTasks: {
              where: {
                deletedAt: null,
                approvalStatus: 'APPROVED',
                status: { notIn: ['DONE', 'CANCELLED'] },
                project: { deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
              },
              select: { startDate: true, dueDate: true, estimatedHours: true },
            },
            availabilitySlots: {
              where: { endAt: { gt: now }, startAt: { lt: weekAhead } },
              select: { startAt: true, endAt: true, kind: true },
            },
            projectMemberships: {
              where: {
                removedAt: null,
                project: { deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
              },
              select: { startDate: true, expectedEndDate: true, estimatedHours: true },
            },
          },
        },
      },
    }),
  ]);

  const constrainedEngineers = members.filter(({ user }) => {
    const profile = user.engineerProfile;
    if (!user.isActive || !profile || profile.status !== 'ACTIVE') return true;
    const capacity = calculateWeeklyCapacity(
      user.assignedTasks.map((task) => ({
        startDate: task.startDate,
        dueDate: task.dueDate,
        estimatedHours: Number(task.estimatedHours ?? 0),
      })),
      user.availabilitySlots,
      Number(profile.weeklyCapacityHours),
      profile.availability,
      now,
    )[0]!;
    const commitment = user.projectMemberships.reduce((hours, member) => {
      if (!member.estimatedHours) return hours;
      const end = member.expectedEndDate?.getTime() ?? now.getTime() + 28 * DAY_MS;
      const start = member.startDate?.getTime() ?? now.getTime();
      if (end < now.getTime() || start > weekAhead.getTime()) return hours;
      return (
        hours + Number(member.estimatedHours) / Math.max(1, Math.ceil((end - start) / (7 * DAY_MS)))
      );
    }, 0);
    return (
      capacity.availableHours <= 0 ||
      Math.max(capacity.estimatedHours, commitment) >= capacity.availableHours
    );
  }).length;
  const healthDetails = deriveProjectHealthDetails({
    status: row.status,
    dueDate: row.dueDate?.toISOString() ?? null,
    overdueMilestones,
    overdueTasks,
    blockedTasks,
    blockedDependencies,
    constrainedEngineers,
    remainingTasks: total - done - cancelled,
    now,
  });

  const project = {
    ...toAdminProject(row),
    clientName: row.client?.companyName ?? null,
  };
  const mappedTasks: AdminTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    dueDate: task.dueDate?.toISOString() ?? null,
    project: task.project,
    assignee: task.assignee,
    createdAt: task.createdAt.toISOString(),
  }));
  const mappedMilestones: AdminMilestone[] = milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    status: milestone.status,
    dueDate: milestone.dueDate?.toISOString() ?? null,
    completedAt: milestone.completedAt?.toISOString() ?? null,
    order: milestone.order,
    project: milestone.project,
    createdAt: milestone.createdAt.toISOString(),
  }));

  return {
    project,
    progress: deriveProgress(total, done),
    health: healthDetails.health,
    healthReasons: healthDetails.reasons,
    healthNote: 'actor' in scope ? row.healthNote : null,
    canEditHealthNote,
    taskCounts: { total, done, open: total - done },
    tasks: mappedTasks,
    milestones: mappedMilestones,
  };
}

// Soft delete — project history is preserved (§7).
export async function deleteProject(id: string, actor?: AuthUser): Promise<void> {
  if (!actor) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null, ...projectManageScope(actor) },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
}
