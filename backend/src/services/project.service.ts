// Projects service (I2.1). Only layer that touches Prisma (§5). Money is stored
// Decimal(12,2) and surfaced as a decimal string; dates as ISO 8601 (§7, §11).
import type {
  AdminProject,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectStatus,
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

// Soft delete — project history is preserved (§7).
export async function deleteProject(id: string): Promise<void> {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Mashruucan lama helin');
  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
}
