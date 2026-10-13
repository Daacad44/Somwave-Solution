// Tasks service (I2.2). Only layer that touches Prisma (§5). A task is scoped to
// its project (the owner key, §7); dates surfaced as ISO 8601 (§11).
import type {
  AdminTask,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  TaskPriority,
  AuthUser,
} from '@somwave/shared';
import { MAX_PAGE_SIZE } from '@somwave/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { projectManageScope, projectScope } from './project.service';

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
  actor?: AuthUser;
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
  actor,
}: ListTasksParams): Promise<PagedTasks> {
  const take = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const skip = (Math.max(page, 1) - 1) * take;

  const where: Prisma.TaskWhereInput = {
    deletedAt: null,
    ...(actor ? { project: projectScope(actor) } : {}),
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

export async function getTask(id: string, actor?: AuthUser): Promise<AdminTask | null> {
  const row = await prisma.task.findFirst({
    where: { id, deletedAt: null, ...(actor ? { project: projectScope(actor) } : {}) },
    select: adminTaskSelect,
  });
  return row ? toAdminTask(row) : null;
}

async function assertProjectExists(projectId: string, actor?: AuthUser): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null, ...projectScope(actor) },
    select: { id: true },
  });
  if (!project) throw new AppError('VALIDATION_ERROR', 400, 'Project not found');
}

async function assertAssigneeExists(
  assigneeId: string | null | undefined,
  projectId?: string,
): Promise<void> {
  if (!assigneeId) return;
  const user = await prisma.user.findFirst({
    where: { id: assigneeId, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new AppError('VALIDATION_ERROR', 400, 'Assignee not found');
  if (projectId) {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId: assigneeId, removedAt: null },
      select: { id: true },
    });
    if (!membership)
      throw new AppError('VALIDATION_ERROR', 400, 'Assignee must be an active project member');
  }
}

export async function createTask(input: CreateTaskInput, actor?: AuthUser): Promise<AdminTask> {
  if (!actor) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  await assertProjectExists(input.projectId, actor);
  if (!actor.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN')) {
    const manager = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        ...projectManageScope(actor),
      },
      select: { id: true },
    });
    if (!manager)
      throw new AppError('FORBIDDEN', 403, 'Use the engineering task proposal workflow');
  }
  await assertAssigneeExists(input.assigneeId, actor ? input.projectId : undefined);

  const row = await prisma.task.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      approvalStatus: 'APPROVED',
      reviewRequired: false,
    },
    select: adminTaskSelect,
  });
  return toAdminTask(row);
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  actor?: AuthUser,
): Promise<AdminTask> {
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null, ...(actor ? { project: projectScope(actor) } : {}) },
  });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Task not found');

  if (actor && !actor.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN')) {
    const manager = await prisma.project.findFirst({
      where: {
        id: task.projectId,
        OR: [
          { managerId: actor.id },
          { members: { some: { userId: actor.id, role: 'MANAGER', removedAt: null } } },
        ],
      },
      select: { id: true },
    });
    if (
      !manager &&
      (task.assigneeId !== actor.id ||
        task.approvalStatus !== 'APPROVED' ||
        Object.keys(input).some((key) => key !== 'status'))
    ) {
      throw new AppError('FORBIDDEN', 403, 'Only an approved task assigned to you can be updated');
    }
  }

  if (input.assigneeId)
    await assertAssigneeExists(input.assigneeId, actor ? task.projectId : undefined);

  if (input.status && input.status !== task.status && task.reviewRequired) {
    if (task.approvalStatus !== 'APPROVED') {
      throw new AppError('CONFLICT', 409, 'The task proposal must be approved before work begins');
    }
    const transitions: Record<string, readonly string[]> = {
      BACKLOG: ['TODO', 'CANCELLED'],
      TODO: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
      IN_PROGRESS: ['BLOCKED', 'IN_REVIEW', 'CANCELLED'],
      BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
      IN_REVIEW: ['TESTING', 'IN_PROGRESS'],
      TESTING: ['DONE', 'IN_PROGRESS'],
      DONE: ['IN_PROGRESS'],
      CANCELLED: [],
    };
    if (!transitions[task.status]?.includes(input.status)) {
      throw new AppError(
        'CONFLICT',
        409,
        `Cannot move task from ${task.status} to ${input.status}`,
      );
    }
    if (input.status === 'IN_PROGRESS') {
      const pending = await prisma.taskDependency.count({
        where: { taskId: id, dependsOn: { status: { not: 'DONE' }, deletedAt: null } },
      });
      if (pending) throw new AppError('CONFLICT', 409, 'Complete prerequisite tasks first');
    }
    if (input.status === 'IN_REVIEW') {
      const incomplete = await prisma.taskChecklistItem.count({
        where: { taskId: id, completedAt: null },
      });
      if (incomplete) throw new AppError('CONFLICT', 409, 'Complete the checklist before review');
    }
    if (input.status === 'DONE' && !task.qaVerifiedAt) {
      throw new AppError('CONFLICT', 409, 'QA verification is required before completion');
    }
    if (!actor) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    return prisma.$transaction(async (tx) => {
      const changed = await tx.task.updateMany({
        where: { id, status: task.status, approvalStatus: 'APPROVED' },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          status: input.status,
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
          ...(input.dueDate !== undefined
            ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
            : {}),
          completedAt: input.status === 'DONE' ? new Date() : null,
          ...(input.status === 'IN_PROGRESS' && task.qaVerifiedAt
            ? { qaVerifiedAt: null, qaVerifiedById: null }
            : {}),
        },
      });
      if (!changed.count)
        throw new AppError('CONFLICT', 409, 'Task changed; reload before updating');
      await tx.taskTransition.create({
        data: { taskId: id, actorId: actor.id, fromStatus: task.status, toStatus: input.status! },
      });
      const row = await tx.task.findUniqueOrThrow({ where: { id }, select: adminTaskSelect });
      return toAdminTask(row);
    });
  }

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
export async function deleteTask(id: string, actor?: AuthUser): Promise<void> {
  if (!actor) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null, project: projectManageScope(actor) },
  });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Task not found');
  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
}
