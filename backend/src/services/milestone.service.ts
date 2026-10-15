// Milestones service (I2.3). Only layer that touches Prisma (§5). A milestone is
// scoped to its project (the owner key, §7); dates surfaced as ISO 8601 (§11).
// Reaching COMPLETED stamps completedAt; leaving it clears the stamp.
import type {
  AdminMilestone,
  CreateMilestoneInput,
  UpdateMilestoneInput,
  MilestoneStatus,
  AuthUser,
  MilestoneDependencyRecord,
} from '@somwave/shared';
import { MAX_PAGE_SIZE } from '@somwave/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { projectManageScope, projectScope } from './project.service';

const adminMilestoneSelect = {
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
} as const;

type MilestoneRow = {
  id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  clientVisible: boolean;
  owner: { id: string; name: string } | null;
  verifiedBy: { id: string; name: string } | null;
  verifiedAt: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  order: number;
  createdAt: Date;
  project: { id: string; name: string };
};

function toAdminMilestone(
  row: MilestoneRow,
  taskCount?: { total: number; done: number },
): AdminMilestone {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    clientVisible: row.clientVisible ?? false,
    owner: row.owner,
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    linkedTaskCount: taskCount?.total,
    progressPercent: taskCount
      ? taskCount.total
        ? Math.round((taskCount.done / taskCount.total) * 100)
        : null
      : undefined,
    dueDate: row.dueDate?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    order: row.order,
    project: row.project,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ListMilestonesParams {
  page: number;
  pageSize: number;
  projectId?: string;
  status?: MilestoneStatus;
  actor?: AuthUser;
}

export interface PagedMilestones {
  items: AdminMilestone[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listMilestones({
  page,
  pageSize,
  projectId,
  status,
  actor,
}: ListMilestonesParams): Promise<PagedMilestones> {
  const take = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const skip = (Math.max(page, 1) - 1) * take;

  const where: Prisma.MilestoneWhereInput = {
    deletedAt: null,
    ...(projectId ? { projectId } : {}),
    ...(status ? { status } : {}),
    ...(actor ? { project: projectScope(actor) } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.milestone.findMany({
      where,
      select: adminMilestoneSelect,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.milestone.count({ where }),
  ]);

  const taskCounts = await milestoneTaskCounts(rows.map((row) => row.id));
  return {
    items: rows.map((row) => toAdminMilestone(row, taskCounts.get(row.id))),
    page: Math.max(page, 1),
    pageSize: take,
    total,
  };
}

async function milestoneTaskCounts(
  ids: string[],
): Promise<Map<string, { total: number; done: number }>> {
  const result = new Map<string, { total: number; done: number }>();
  if (!ids.length) return result;
  const groups = await prisma.task.groupBy({
    by: ['milestoneId', 'status'],
    where: { milestoneId: { in: ids }, deletedAt: null, approvalStatus: 'APPROVED' },
    _count: { _all: true },
  });
  for (const group of groups) {
    if (!group.milestoneId) continue;
    const count = result.get(group.milestoneId) ?? { total: 0, done: 0 };
    count.total += group._count._all;
    if (group.status === 'DONE') count.done += group._count._all;
    result.set(group.milestoneId, count);
  }
  return result;
}

export async function getMilestone(id: string, actor?: AuthUser): Promise<AdminMilestone | null> {
  const row = await prisma.milestone.findFirst({
    where: { id, deletedAt: null, ...(actor ? { project: projectScope(actor) } : {}) },
    select: adminMilestoneSelect,
  });
  if (!row) return null;
  return toAdminMilestone(
    row,
    (await milestoneTaskCounts([row.id])).get(row.id) ?? { total: 0, done: 0 },
  );
}

async function assertManageableProject(projectId: string, actor: AuthUser): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null, ...projectManageScope(actor) },
    select: { id: true },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
}

async function assertOwner(projectId: string, ownerId: string | null | undefined): Promise<void> {
  if (!ownerId) return;
  const member = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId: ownerId,
      removedAt: null,
      user: { isActive: true, deletedAt: null },
    },
    select: { id: true },
  });
  if (!member)
    throw new AppError('VALIDATION_ERROR', 400, 'Milestone owner must be an active project member');
}

// completedAt tracks the COMPLETED status: set on reaching it, cleared on leaving.
function completionStamp(
  status: MilestoneStatus | undefined,
  wasCompleted: boolean,
): Date | null | undefined {
  if (status === undefined) return undefined;
  if (status === 'COMPLETED') return wasCompleted ? undefined : new Date();
  return wasCompleted ? null : undefined;
}

export async function createMilestone(
  input: CreateMilestoneInput,
  actor?: AuthUser,
): Promise<AdminMilestone> {
  if (!actor) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  await assertManageableProject(input.projectId, actor);
  await assertOwner(input.projectId, input.ownerId);

  const row = await prisma.milestone.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      clientVisible: input.clientVisible,
      ownerId: input.ownerId ?? null,
      verifiedById: input.status === 'COMPLETED' ? actor.id : null,
      verifiedAt: input.status === 'COMPLETED' ? new Date() : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      order: input.order,
      completedAt: input.status === 'COMPLETED' ? new Date() : null,
    },
    select: adminMilestoneSelect,
  });
  await writeAudit({
    actorId: actor.id,
    action: 'milestone.create',
    subjectType: 'Milestone',
    subjectId: row.id,
    after: { projectId: input.projectId, title: row.title, status: row.status },
  });
  return toAdminMilestone(row);
}

export async function updateMilestone(
  id: string,
  input: UpdateMilestoneInput,
  actor?: AuthUser,
): Promise<AdminMilestone> {
  if (!actor) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const milestone = await prisma.milestone.findFirst({
    where: { id, deletedAt: null, project: projectManageScope(actor) },
    select: { id: true, status: true, projectId: true },
  });
  if (!milestone) throw new AppError('NOT_FOUND', 404, 'Milestone not found');
  await assertOwner(milestone.projectId, input.ownerId);
  if (input.status === 'COMPLETED' && milestone.status !== 'COMPLETED') {
    const openTasks = await prisma.task.count({
      where: {
        milestoneId: id,
        deletedAt: null,
        approvalStatus: 'APPROVED',
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
    });
    if (openTasks)
      throw new AppError('CONFLICT', 409, 'Complete linked tasks before verifying the milestone');
    const unmetMilestones = await prisma.milestoneDependency.count({
      where: { milestoneId: id, dependsOn: { deletedAt: null, status: { not: 'COMPLETED' } } },
    });
    if (unmetMilestones)
      throw new AppError(
        'CONFLICT',
        409,
        'Complete prerequisite milestones before verifying this milestone',
      );
  }
  if (milestone.status === 'COMPLETED' && input.status && input.status !== 'COMPLETED') {
    const completedDependents = await prisma.milestoneDependency.count({
      where: { dependsOnId: id, milestone: { deletedAt: null, status: 'COMPLETED' } },
    });
    if (completedDependents)
      throw new AppError(
        'CONFLICT',
        409,
        'Reopen dependent milestones before reopening this milestone',
      );
  }

  const stamp = completionStamp(input.status, milestone.status === 'COMPLETED');

  const row = await prisma.milestone.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.clientVisible !== undefined ? { clientVisible: input.clientVisible } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.status !== undefined && input.status !== milestone.status
        ? {
            verifiedById: input.status === 'COMPLETED' ? actor.id : null,
            verifiedAt: input.status === 'COMPLETED' ? new Date() : null,
          }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(stamp !== undefined ? { completedAt: stamp } : {}),
    },
    select: adminMilestoneSelect,
  });
  await writeAudit({
    actorId: actor.id,
    action: 'milestone.update',
    subjectType: 'Milestone',
    subjectId: id,
    before: { projectId: milestone.projectId, status: milestone.status },
    after: { projectId: milestone.projectId, status: row.status, clientVisible: row.clientVisible },
  });
  return toAdminMilestone(row);
}

// Soft delete — milestone history is preserved (§7).
export async function deleteMilestone(id: string, actor?: AuthUser): Promise<void> {
  if (!actor) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const milestone = await prisma.milestone.findFirst({
    where: { id, deletedAt: null, project: projectManageScope(actor) },
  });
  if (!milestone) throw new AppError('NOT_FOUND', 404, 'Milestone not found');
  const completedDependents = await prisma.milestoneDependency.count({
    where: { dependsOnId: id, milestone: { deletedAt: null, status: 'COMPLETED' } },
  });
  if (completedDependents)
    throw new AppError(
      'CONFLICT',
      409,
      'Reopen dependent milestones before deleting this milestone',
    );
  await prisma.milestone.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({
    actorId: actor.id,
    action: 'milestone.delete',
    subjectType: 'Milestone',
    subjectId: id,
    after: { projectId: milestone.projectId },
  });
}

async function requireMilestone(id: string, actor: AuthUser | undefined, manage: boolean) {
  if (!actor) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const milestone = await prisma.milestone.findFirst({
    where: {
      id,
      deletedAt: null,
      project: manage ? projectManageScope(actor) : projectScope(actor),
    },
    select: { id: true, projectId: true, status: true },
  });
  if (!milestone) throw new AppError('NOT_FOUND', 404, 'Milestone not found');
  return milestone;
}

export async function listMilestoneDependencies(
  id: string,
  actor?: AuthUser,
): Promise<MilestoneDependencyRecord[]> {
  await requireMilestone(id, actor, false);
  const rows = await prisma.milestoneDependency.findMany({
    where: { milestoneId: id, dependsOn: { deletedAt: null } },
    select: {
      id: true,
      createdAt: true,
      dependsOn: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    dependsOn: row.dependsOn,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function addMilestoneDependency(
  id: string,
  dependsOnId: string,
  actor?: AuthUser,
): Promise<MilestoneDependencyRecord> {
  const milestone = await requireMilestone(id, actor, true);
  if (id === dependsOnId)
    throw new AppError('VALIDATION_ERROR', 400, 'A milestone cannot depend on itself');
  const dependsOn = await prisma.milestone.findFirst({
    where: { id: dependsOnId, projectId: milestone.projectId, deletedAt: null },
    select: { id: true, title: true, status: true },
  });
  if (!dependsOn)
    throw new AppError('VALIDATION_ERROR', 400, 'Prerequisite must belong to the same project');
  if (milestone.status === 'COMPLETED' && dependsOn.status !== 'COMPLETED')
    throw new AppError(
      'CONFLICT',
      409,
      'Reopen this milestone before adding an incomplete prerequisite',
    );
  return prisma.$transaction(
    async (tx) => {
      const edges = await tx.milestoneDependency.findMany({
        where: {
          milestone: { projectId: milestone.projectId, deletedAt: null },
          dependsOn: { deletedAt: null },
        },
        select: { milestoneId: true, dependsOnId: true },
      });
      if (edges.some((edge) => edge.milestoneId === id && edge.dependsOnId === dependsOnId))
        throw new AppError('CONFLICT', 409, 'Milestone dependency already exists');
      const graph = new Map<string, string[]>();
      for (const edge of edges)
        graph.set(edge.milestoneId, [...(graph.get(edge.milestoneId) ?? []), edge.dependsOnId]);
      const visited = new Set<string>();
      const stack = [dependsOnId];
      while (stack.length) {
        const node = stack.pop()!;
        if (node === id)
          throw new AppError('CONFLICT', 409, 'Milestone dependency would create a cycle');
        if (visited.has(node)) continue;
        visited.add(node);
        stack.push(...(graph.get(node) ?? []));
      }
      const row = await tx.milestoneDependency.create({
        data: { milestoneId: id, dependsOnId },
        select: { id: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor!.id,
          action: 'milestone.dependency.add',
          subjectType: 'Milestone',
          subjectId: id,
          after: { projectId: milestone.projectId, dependsOnId },
        },
      });
      return { id: row.id, dependsOn, createdAt: row.createdAt.toISOString() };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function removeMilestoneDependency(
  id: string,
  dependsOnId: string,
  actor?: AuthUser,
): Promise<void> {
  const milestone = await requireMilestone(id, actor, true);
  await prisma.$transaction(async (tx) => {
    const removed = await tx.milestoneDependency.deleteMany({
      where: { milestoneId: id, dependsOnId },
    });
    if (!removed.count) throw new AppError('NOT_FOUND', 404, 'Milestone dependency not found');
    await tx.auditLog.create({
      data: {
        actorId: actor!.id,
        action: 'milestone.dependency.remove',
        subjectType: 'Milestone',
        subjectId: id,
        after: { projectId: milestone.projectId, dependsOnId },
      },
    });
  });
}
