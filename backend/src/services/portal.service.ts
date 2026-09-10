import type { AdminProject } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

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
