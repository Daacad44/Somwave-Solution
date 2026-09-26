// Projects service (I2.1). Only layer that touches Prisma (§5). Money is stored
// Decimal(12,2) and surfaced as a decimal string; dates as ISO 8601 (§7, §11).
import type {
  AdminMilestone,
  AdminProject,
  AdminTask,
  CreateProjectInput,
  ProjectHealth,
  ProjectStatus,
  ProjectWorkspace,
  TaskPriority,
  TaskStatus,
  UpdateProjectInput,
} from '@somwave/shared';
import { MAX_PAGE_SIZE } from '@somwave/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

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
}: ListProjectsParams): Promise<PagedProjects> {
  const take = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const skip = (Math.max(page, 1) - 1) * take;

  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
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
  if (input.status === 'COMPLETED') return 'COMPLETE';
  if (input.status === 'CANCELLED') return 'CANCELLED';
  if (!input.dueDate) return 'NO_DATE';
  const due = Date.parse(input.dueDate);
  if (Number.isNaN(due)) return 'NO_DATE';
  const now = (input.now ?? new Date()).getTime();
  if (due < now) return 'OVERDUE';
  if (due - now <= 7 * DAY_MS) return 'AT_RISK';
  return 'ON_TRACK';
}

export async function getProject(id: string): Promise<AdminProject | null> {
  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: adminProjectSelect,
  });
  return row ? toAdminProject(row) : null;
}

// A managerId, when given, must belong to a real active user.
async function assertManagerExists(managerId: string | null | undefined): Promise<void> {
  if (!managerId) return;
  const manager = await prisma.user.findFirst({
    where: { id: managerId, deletedAt: null },
    select: { id: true },
  });
  if (!manager) throw new AppError('VALIDATION_ERROR', 400, 'Maareeyaha lama helin');
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

export async function updateProject(id: string, input: UpdateProjectInput): Promise<AdminProject> {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Mashruucan lama helin');

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

export async function getProjectWorkspace(id: string): Promise<ProjectWorkspace | null> {
  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...adminProjectSelect,
      client: { select: { companyName: true } },
    },
  });
  if (!row) return null;

  const [tasks, milestones, total, done] = await Promise.all([
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
  ]);

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
    health: deriveProjectHealth({ status: project.status, dueDate: project.dueDate }),
    taskCounts: { total, done, open: total - done },
    tasks: mappedTasks,
    milestones: mappedMilestones,
  };
}

// Soft delete — project history is preserved (§7).
export async function deleteProject(id: string): Promise<void> {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Mashruucan lama helin');
  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
}
