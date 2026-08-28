// Tasks service (I2.2). Only layer that touches Prisma (§5). A task is scoped to
// its project (the owner key, §7); dates surfaced as ISO 8601 (§11).
import type {
  AdminTask,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  TaskPriority,
} from '@somwave/shared';
import { MAX_PAGE_SIZE } from '@somwave/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

const adminTaskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} as const;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  createdAt: Date;
  project: { id: string; name: string };
  assignee: { id: string; name: string } | null;
};

function toAdminTask(row: TaskRow): AdminTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate?.toISOString() ?? null,
    project: row.project,
    assignee: row.assignee,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ListTasksParams {
  page: number;
  pageSize: number;
  projectId?: string;
  status?: TaskStatus;
}

export interface PagedTasks {
  items: AdminTask[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listTasks({
  page,
  pageSize,
  projectId,
  status,
}: ListTasksParams): Promise<PagedTasks> {
  const take = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const skip = (Math.max(page, 1) - 1) * take;

  const where: Prisma.TaskWhereInput = {
    deletedAt: null,
    ...(projectId ? { projectId } : {}),
    ...(status ? { status } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      select: adminTaskSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.task.count({ where }),
  ]);

  return { items: rows.map(toAdminTask), page: Math.max(page, 1), pageSize: take, total };
}

export async function getTask(id: string): Promise<AdminTask | null> {
  const row = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: adminTaskSelect,
  });
  return row ? toAdminTask(row) : null;
}

async function assertProjectExists(projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new AppError('VALIDATION_ERROR', 400, 'Mashruuca lama helin');
}

async function assertAssigneeExists(assigneeId: string | null | undefined): Promise<void> {
  if (!assigneeId) return;
  const user = await prisma.user.findFirst({
    where: { id: assigneeId, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new AppError('VALIDATION_ERROR', 400, 'Qofka loo xilsaaray lama helin');
}

export async function createTask(input: CreateTaskInput): Promise<AdminTask> {
  await assertProjectExists(input.projectId);
  await assertAssigneeExists(input.assigneeId);

  const row = await prisma.task.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
    select: adminTaskSelect,
  });
  return toAdminTask(row);
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<AdminTask> {
  const task = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Hawshan lama helin');

  if (input.assigneeId) await assertAssigneeExists(input.assigneeId);

  const row = await prisma.task.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
    },
    select: adminTaskSelect,
  });
  return toAdminTask(row);
}

// Soft delete — task history is preserved (§7).
export async function deleteTask(id: string): Promise<void> {
  const task = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Hawshan lama helin');
  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
}
