// Milestones service (I2.3). Only layer that touches Prisma (§5). A milestone is
// scoped to its project (the owner key, §7); dates surfaced as ISO 8601 (§11).
// Reaching COMPLETED stamps completedAt; leaving it clears the stamp.
import type {
  AdminMilestone,
  CreateMilestoneInput,
  UpdateMilestoneInput,
  MilestoneStatus,
} from '@somwave/shared';
import { MAX_PAGE_SIZE } from '@somwave/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

const adminMilestoneSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
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
  dueDate: Date | null;
  completedAt: Date | null;
  order: number;
  createdAt: Date;
  project: { id: string; name: string };
};

function toAdminMilestone(row: MilestoneRow): AdminMilestone {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
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
}: ListMilestonesParams): Promise<PagedMilestones> {
  const take = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const skip = (Math.max(page, 1) - 1) * take;

  const where: Prisma.MilestoneWhereInput = {
    deletedAt: null,
    ...(projectId ? { projectId } : {}),
    ...(status ? { status } : {}),
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

  return { items: rows.map(toAdminMilestone), page: Math.max(page, 1), pageSize: take, total };
}

export async function getMilestone(id: string): Promise<AdminMilestone | null> {
  const row = await prisma.milestone.findFirst({
    where: { id, deletedAt: null },
    select: adminMilestoneSelect,
  });
  return row ? toAdminMilestone(row) : null;
}

async function assertProjectExists(projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new AppError('VALIDATION_ERROR', 400, 'Mashruuca lama helin');
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

export async function createMilestone(input: CreateMilestoneInput): Promise<AdminMilestone> {
  await assertProjectExists(input.projectId);

  const row = await prisma.milestone.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      order: input.order,
      completedAt: input.status === 'COMPLETED' ? new Date() : null,
    },
    select: adminMilestoneSelect,
  });
  return toAdminMilestone(row);
}

export async function updateMilestone(
  id: string,
  input: UpdateMilestoneInput,
): Promise<AdminMilestone> {
  const milestone = await prisma.milestone.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!milestone) throw new AppError('NOT_FOUND', 404, 'Marxaladdan lama helin');

  const stamp = completionStamp(input.status, milestone.status === 'COMPLETED');

  const row = await prisma.milestone.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(stamp !== undefined ? { completedAt: stamp } : {}),
    },
    select: adminMilestoneSelect,
  });
  return toAdminMilestone(row);
}

// Soft delete — milestone history is preserved (§7).
export async function deleteMilestone(id: string): Promise<void> {
  const milestone = await prisma.milestone.findFirst({ where: { id, deletedAt: null } });
  if (!milestone) throw new AppError('NOT_FOUND', 404, 'Marxaladdan lama helin');
  await prisma.milestone.update({ where: { id }, data: { deletedAt: new Date() } });
}
