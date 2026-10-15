// Projects service (I2.1). Only layer that touches Prisma (§5). Money is stored
// Decimal(12,2) and surfaced as a decimal string; dates as ISO 8601 (§7, §11).
import type {
  AdminMilestone,
  AdminProject,
  AdminTask,
  CreateProjectInput,
  ProjectHealth,
  ProjectHealthReason,
  ProjectPortfolio,
  ProjectPortfolioItem,
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
  priority: true,
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
  priority: TaskPriority;
  startDate: Date | null;
  dueDate: Date | null;
  budget: Prisma.Decimal | null;
  clientId: string | null;
  createdAt: Date;
  manager: { id: string; name: string } | null;
};

function canReadProjectBudget(actor?: AuthUser): boolean {
  return (
    !actor ||
    actor.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') ||
    holdsPermission(actor, PERMISSIONS.INVOICES_READ)
  );
}

function canEditProjectBudget(actor?: AuthUser): boolean {
  return (
    !actor ||
    actor.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') ||
    holdsPermission(actor, PERMISSIONS.INVOICES_UPDATE)
  );
}

function toAdminProject(row: ProjectRow, showBudget = true): AdminProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority ?? 'MEDIUM',
    startDate: row.startDate?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    budget: showBudget ? (row.budget?.toString() ?? null) : null,
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

  return {
    items: rows.map((row) => toAdminProject(row, canReadProjectBudget(actor))),
    page: Math.max(page, 1),
    pageSize: take,
    total,
  };
}

export interface ProjectPortfolioFilters {
  actor: AuthUser;
  page: number;
  pageSize: number;
  search?: string;
  status?: ProjectStatus;
  priority?: TaskPriority;
  managerId?: string;
  engineerId?: string;
  assignment?: 'unassigned' | 'pending' | 'active';
  clientId?: string;
  health?: ProjectHealth;
  dueFrom?: string;
  dueTo?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'name' | 'dueDate' | 'createdAt' | 'priority' | 'health' | 'progress';
  sortDirection?: 'asc' | 'desc';
}

/** Portfolio totals are computed from the same scoped records as the list. */
export async function getProjectPortfolio(
  filters: ProjectPortfolioFilters,
): Promise<ProjectPortfolio> {
  const now = new Date();
  const upcoming = new Date(now.getTime() + 7 * DAY_MS);
  const rows = await prisma.project.findMany({
    where: { deletedAt: null, ...projectScope(filters.actor) },
    select: { ...adminProjectSelect, managerId: true, client: { select: { companyName: true } } },
  });
  const ids = rows.map((row) => row.id);
  const page = Math.max(1, filters.page);
  const pageSize = Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE);
  if (!ids.length) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      filters: { managers: [], engineers: [], clients: [] },
      summary: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        planningProjects: 0,
        delayedProjects: 0,
        atRiskProjects: 0,
        assignedEngineers: 0,
        unassignedProjects: 0,
        projectsWithPendingInvitations: 0,
        projectsWithActiveTeams: 0,
        overdueTasks: 0,
        upcomingDeadlines: 0,
      },
    };
  }
  const openTasks: Prisma.TaskWhereInput = {
    projectId: { in: ids },
    deletedAt: null,
    status: { notIn: ['DONE', 'CANCELLED'] },
  };
  const [
    taskGroups,
    overdueTaskGroups,
    blockedTaskGroups,
    overdueMilestoneGroups,
    upcomingTaskGroups,
    upcomingMilestoneGroups,
    members,
    invitations,
  ] = await Promise.all([
    prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: ids }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['projectId'],
      where: { ...openTasks, dueDate: { lt: now } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['projectId'],
      where: { ...openTasks, status: 'BLOCKED' },
      _count: { _all: true },
    }),
    prisma.milestone.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: ids },
        deletedAt: null,
        status: { not: 'COMPLETED' },
        dueDate: { lt: now },
      },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['projectId'],
      where: { ...openTasks, dueDate: { gte: now, lte: upcoming } },
      _count: { _all: true },
    }),
    prisma.milestone.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: ids },
        deletedAt: null,
        status: { not: 'COMPLETED' },
        dueDate: { gte: now, lte: upcoming },
      },
      _count: { _all: true },
    }),
    prisma.projectMember.findMany({
      where: {
        projectId: { in: ids },
        removedAt: null,
        role: { in: ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER', 'REVIEWER', 'CONTRIBUTOR'] },
        user: {
          isActive: true,
          deletedAt: null,
          OR: [{ engineerProfile: { is: null } }, { engineerProfile: { status: 'ACTIVE' } }],
        },
      },
      select: { projectId: true, userId: true, user: { select: { name: true } } },
    }),
    prisma.projectInvitation.findMany({
      where: {
        projectId: { in: ids },
        status: 'PENDING',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { projectId: true, userId: true },
    }),
  ]);
  const counts = new Map<string, { total: number; done: number }>();
  for (const group of taskGroups) {
    const count = counts.get(group.projectId) ?? { total: 0, done: 0 };
    count.total += group._count._all;
    if (group.status === 'DONE') count.done += group._count._all;
    counts.set(group.projectId, count);
  }
  const countMap = (groups: Array<{ projectId: string; _count: { _all: number } }>) =>
    new Map(groups.map((group) => [group.projectId, group._count._all]));
  const overdueTasks = countMap(overdueTaskGroups);
  const blockedTasks = countMap(blockedTaskGroups);
  const overdueMilestones = countMap(overdueMilestoneGroups);
  const upcomingTasks = countMap(upcomingTaskGroups);
  const upcomingMilestones = countMap(upcomingMilestoneGroups);
  const engineers = new Map<string, Set<string>>();
  for (const member of members) {
    const projectEngineers = engineers.get(member.projectId) ?? new Set<string>();
    projectEngineers.add(member.userId);
    engineers.set(member.projectId, projectEngineers);
  }
  const pendingByProject = new Map<string, Set<string>>();
  for (const invitation of invitations) {
    const pending = pendingByProject.get(invitation.projectId) ?? new Set<string>();
    pending.add(invitation.userId);
    pendingByProject.set(invitation.projectId, pending);
  }
  const portfolio: ProjectPortfolioItem[] = rows.map((row) => {
    const taskCounts = counts.get(row.id) ?? { total: 0, done: 0 };
    const health = deriveProjectHealthDetails({
      status: row.status,
      dueDate: row.dueDate?.toISOString() ?? null,
      overdueTasks: overdueTasks.get(row.id) ?? 0,
      blockedTasks: blockedTasks.get(row.id) ?? 0,
      overdueMilestones: overdueMilestones.get(row.id) ?? 0,
      remainingTasks: taskCounts.total - taskCounts.done,
      now,
    }).health;
    const assignedEngineers = engineers.get(row.id)?.size ?? 0;
    const pendingInvitations = pendingByProject.get(row.id)?.size ?? 0;
    return {
      ...toAdminProject(row, canReadProjectBudget(filters.actor)),
      clientName: row.client?.companyName ?? null,
      health,
      progress: deriveProgress(taskCounts.total, taskCounts.done),
      taskCount: taskCounts.total,
      overdueTasks: overdueTasks.get(row.id) ?? 0,
      assignedEngineers,
      pendingInvitations,
      assignmentStatus: assignedEngineers
        ? 'ACTIVE'
        : pendingInvitations
          ? 'PENDING'
          : 'UNASSIGNED',
    };
  });
  const summary = {
    totalProjects: portfolio.length,
    activeProjects: portfolio.filter((row) => row.status === 'ACTIVE').length,
    completedProjects: portfolio.filter((row) => row.status === 'COMPLETED').length,
    planningProjects: portfolio.filter((row) => row.status === 'PLANNING').length,
    delayedProjects: portfolio.filter((row) => row.health === 'OVERDUE').length,
    atRiskProjects: portfolio.filter((row) => row.health === 'AT_RISK').length,
    assignedEngineers: new Set(members.map((member) => member.userId)).size,
    unassignedProjects: portfolio.filter((row) => row.assignedEngineers === 0).length,
    projectsWithPendingInvitations: portfolio.filter((row) => row.pendingInvitations > 0).length,
    projectsWithActiveTeams: portfolio.filter((row) => row.assignedEngineers > 0).length,
    overdueTasks: [...overdueTasks.values()].reduce((total, count) => total + count, 0),
    upcomingDeadlines:
      portfolio.filter(
        (row) =>
          row.dueDate &&
          Date.parse(row.dueDate) >= now.getTime() &&
          Date.parse(row.dueDate) <= upcoming.getTime(),
      ).length +
      [...upcomingTasks.values()].reduce((total, count) => total + count, 0) +
      [...upcomingMilestones.values()].reduce((total, count) => total + count, 0),
  };
  const filterOptions = {
    managers: [
      ...new Map(
        rows.filter((row) => row.manager).map((row) => [row.manager!.id, row.manager!]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name)),
    engineers: [
      ...new Map(
        members.map((member) => [member.userId, { id: member.userId, name: member.user.name }]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name)),
    clients: [
      ...new Map(
        rows
          .filter((row) => row.clientId && row.client)
          .map((row) => [row.clientId!, { id: row.clientId!, name: row.client!.companyName }]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name)),
  };
  const inRange = (value: string | null, from?: string, to?: string) => {
    if (!from && !to) return true;
    if (!value) return false;
    const timestamp = Date.parse(value);
    return (
      (!from || timestamp >= Date.parse(from)) && (!to || timestamp <= Date.parse(to) + DAY_MS - 1)
    );
  };
  const needle = filters.search?.trim().toLowerCase();
  const filtered = portfolio.filter(
    (row) =>
      (!needle ||
        row.name.toLowerCase().includes(needle) ||
        row.clientName?.toLowerCase().includes(needle)) &&
      (!filters.status || row.status === filters.status) &&
      (!filters.priority || row.priority === filters.priority) &&
      (!filters.managerId || row.manager?.id === filters.managerId) &&
      (!filters.clientId || row.clientId === filters.clientId) &&
      (!filters.engineerId || engineers.get(row.id)?.has(filters.engineerId)) &&
      (!filters.assignment ||
        (filters.assignment === 'unassigned' && row.assignedEngineers === 0) ||
        (filters.assignment === 'pending' && row.pendingInvitations > 0) ||
        (filters.assignment === 'active' && row.assignedEngineers > 0)) &&
      (!filters.health || row.health === filters.health) &&
      inRange(row.dueDate, filters.dueFrom, filters.dueTo) &&
      inRange(row.createdAt, filters.createdFrom, filters.createdTo),
  );
  const direction = filters.sortDirection === 'asc' ? 1 : -1;
  const sortBy = filters.sortBy ?? 'createdAt';
  const priorityRank = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
  filtered.sort((a, b) => {
    if (sortBy === 'priority')
      return direction * (priorityRank[a.priority] - priorityRank[b.priority]);
    if (sortBy === 'progress') return direction * ((a.progress ?? -1) - (b.progress ?? -1));
    const left = sortBy === 'name' ? a.name : sortBy === 'health' ? a.health : (a[sortBy] ?? '');
    const right = sortBy === 'name' ? b.name : sortBy === 'health' ? b.health : (b[sortBy] ?? '');
    return direction * left.localeCompare(right);
  });
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filtered.length,
    summary,
    filters: filterOptions,
  };
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
  return row ? toAdminProject(row, canReadProjectBudget(actor)) : null;
}

// A managerId grants project management access, so it must be an active manager.
async function assertManagerExists(managerId: string | null | undefined): Promise<void> {
  if (!managerId) return;
  const manager = await prisma.user.findFirst({
    where: {
      id: managerId,
      isActive: true,
      deletedAt: null,
      roles: { some: { role: { name: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] } } } },
    },
    select: { id: true },
  });
  if (!manager) throw new AppError('VALIDATION_ERROR', 400, 'Manager not found');
}

export async function createProject(
  input: CreateProjectInput,
  actor?: AuthUser,
): Promise<AdminProject> {
  if (input.budget !== undefined && actor && !canEditProjectBudget(actor))
    throw new AppError('FORBIDDEN', 403, 'Financial access required');
  await assertManagerExists(input.managerId);

  const row = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      budget: input.budget ? new Prisma.Decimal(input.budget) : null,
      clientId: input.clientId ?? null,
      managerId: input.managerId ?? null,
    },
    select: adminProjectSelect,
  });
  if (actor)
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'project.create',
        subjectType: 'Project',
        subjectId: row.id,
        after: { name: row.name, status: row.status, priority: row.priority },
      },
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

  if (input.budget !== undefined && !canEditProjectBudget(actor))
    throw new AppError('FORBIDDEN', 403, 'Financial access required');
  if (
    input.budget !== undefined &&
    input.budget !== project.budget?.toString() &&
    !(input.budget && project.budget?.equals(new Prisma.Decimal(input.budget)))
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Use the budget revision action to record a budget change reason',
    );
  }

  if (input.managerId) await assertManagerExists(input.managerId);

  const row = await prisma.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.startDate !== undefined
        ? { startDate: input.startDate ? new Date(input.startDate) : null }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
    },
    select: adminProjectSelect,
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'project.update',
      subjectType: 'Project',
      subjectId: id,
      before: {
        name: project.name,
        status: project.status,
        priority: project.priority,
        budget: project.budget?.toString() ?? null,
      },
      after: {
        name: row.name,
        status: row.status,
        priority: row.priority,
        budget: row.budget?.toString() ?? null,
      },
    },
  });
  return toAdminProject(row, canReadProjectBudget(actor));
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
  const clientView = 'clientId' in scope;
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
    ...(clientView ? { approvalStatus: 'APPROVED' as const } : {}),
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
      where: { projectId: id, deletedAt: null, ...(clientView ? { id: { in: [] } } : {}) },
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
      where: { projectId: id, deletedAt: null, ...(clientView ? { clientVisible: true } : {}) },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        clientVisible: true,
        owner: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
        verifiedAt: true,
        dueDate: true,
        completedAt: true,
        order: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.task.count({
      where: {
        projectId: id,
        deletedAt: null,
        ...(clientView ? { approvalStatus: 'APPROVED' } : {}),
      },
    }),
    prisma.task.count({
      where: {
        projectId: id,
        deletedAt: null,
        status: 'DONE',
        ...(clientView ? { approvalStatus: 'APPROVED' } : {}),
      },
    }),
    prisma.task.count({
      where: {
        projectId: id,
        deletedAt: null,
        status: 'CANCELLED',
        ...(clientView ? { approvalStatus: 'APPROVED' } : {}),
      },
    }),
    prisma.task.count({ where: { ...openTaskWhere, dueDate: { lt: now } } }),
    prisma.task.count({ where: { ...openTaskWhere, status: 'BLOCKED' } }),
    prisma.milestone.count({
      where: {
        projectId: id,
        deletedAt: null,
        status: { not: 'COMPLETED' },
        dueDate: { lt: now },
        ...(clientView ? { clientVisible: true } : {}),
      },
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
    overdueMilestones: clientView ? 0 : overdueMilestones,
    overdueTasks: clientView ? 0 : overdueTasks,
    blockedTasks: clientView ? 0 : blockedTasks,
    blockedDependencies: clientView ? 0 : blockedDependencies,
    constrainedEngineers: clientView ? 0 : constrainedEngineers,
    remainingTasks: total - done - cancelled,
    now,
  });

  const project = {
    ...toAdminProject(row, 'actor' in scope ? canReadProjectBudget(scope.actor) : false),
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
    clientVisible: milestone.clientVisible,
    owner: clientView ? null : milestone.owner,
    verifiedBy: clientView ? null : milestone.verifiedBy,
    verifiedAt: clientView ? null : (milestone.verifiedAt?.toISOString() ?? null),
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
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'project.archive',
      subjectType: 'Project',
      subjectId: id,
    },
  });
}
