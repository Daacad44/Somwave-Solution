import type { AdminProject, AdminMilestone, ProjectWorkspace } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { getProjectWorkspace } from './project.service';

function toProject(row: {
  id: string;
  name: string;
  description: string | null;
  status: AdminProject['status'];
  startDate: Date | null;
  dueDate: Date | null;
  budget: { toString(): string } | null;
  clientId: string | null;
  createdAt: Date;
  manager: { id: string; name: string } | null;
}): AdminProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.startDate?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    budget: row.budget ? row.budget.toString() : null,
    clientId: row.clientId,
    manager: row.manager,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPortalProjects(clientId: string | null): Promise<AdminProject[]> {
  if (!clientId) throw new AppError('NOT_FOUND', 404, 'Mashruuc lama helin');
  const rows = await prisma.project.findMany({
    where: { clientId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { manager: { select: { id: true, name: true } } },
  });
  return rows.map(toProject);
}

export async function getPortalProject(
  clientId: string | null,
  id: string,
): Promise<ProjectWorkspace> {
  if (!clientId) throw new AppError('NOT_FOUND', 404, 'Mashruuc lama helin');
  const owned = await prisma.project.findFirst({
    where: { id, clientId, deletedAt: null },
    select: { id: true },
  });
  if (!owned) throw new AppError('NOT_FOUND', 404, 'Mashruuc lama helin');
  const workspace = await getProjectWorkspace(id);
  if (!workspace) throw new AppError('NOT_FOUND', 404, 'Mashruuc lama helin');
  return workspace;
}

export async function listPortalMilestones(clientId: string | null): Promise<AdminMilestone[]> {
  if (!clientId) throw new AppError('NOT_FOUND', 404, 'Marxalad lama helin');
  const rows = await prisma.milestone.findMany({
    where: { deletedAt: null, project: { clientId, deletedAt: null } },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
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
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.dueDate?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    order: row.order,
    project: row.project,
    createdAt: row.createdAt.toISOString(),
  }));
}
