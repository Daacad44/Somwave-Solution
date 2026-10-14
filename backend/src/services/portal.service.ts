import type { AdminProject, AdminMilestone, ProjectWorkspace } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { getProjectWorkspace } from './project.service';
import { readObject } from '../lib/storage';

function toProject(row: {
  id: string;
  name: string;
  description: string | null;
  status: AdminProject['status'];
  priority: AdminProject['priority'];
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
    priority: row.priority,
    startDate: row.startDate?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    budget: null,
    clientId: row.clientId,
    manager: row.manager,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPortalProjects(clientId: string | null): Promise<AdminProject[]> {
  if (!clientId) throw new AppError('NOT_FOUND', 404, 'Project not found');
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
  const workspace = await getProjectWorkspace(id, { clientId });
  if (!workspace) throw new AppError('NOT_FOUND', 404, 'Mashruuc lama helin');
  return workspace;
}

export async function listPortalMilestones(clientId: string | null): Promise<AdminMilestone[]> {
  if (!clientId) throw new AppError('NOT_FOUND', 404, 'Milestone not found');
  const rows = await prisma.milestone.findMany({
    where: { deletedAt: null, clientVisible: true, project: { clientId, deletedAt: null } },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      clientVisible: true,
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
    clientVisible: row.clientVisible,
    owner: null,
    verifiedBy: null,
    verifiedAt: null,
    dueDate: row.dueDate?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    order: row.order,
    project: row.project,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listPortalDocuments(clientId: string | null, projectId: string) {
  if (!clientId) throw new AppError('NOT_FOUND', 404, 'Project not found');
  const project = await prisma.project.findFirst({
    where: { id: projectId, clientId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  const rows = await prisma.projectDocumentation.findMany({
    where: { projectId, status: 'APPROVED', clientVisible: true, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      category: true,
      format: true,
      content: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      updatedAt: true,
    },
  });
  return rows.map(({ updatedAt, ...row }) => ({ ...row, updatedAt: updatedAt.toISOString() }));
}

export async function getPortalDocumentFile(
  clientId: string | null,
  projectId: string,
  documentId: string,
) {
  if (!clientId) throw new AppError('NOT_FOUND', 404, 'Document not found');
  const row = await prisma.projectDocumentation.findFirst({
    where: {
      id: documentId,
      projectId,
      status: 'APPROVED',
      clientVisible: true,
      deletedAt: null,
      project: { clientId, deletedAt: null },
    },
    select: { storageKey: true, mimeType: true, fileName: true, title: true },
  });
  if (!row?.storageKey || !row.mimeType) throw new AppError('NOT_FOUND', 404, 'Document not found');
  const bytes = await readObject(row.storageKey);
  if (!bytes) throw new AppError('NOT_FOUND', 404, 'Document not found');
  return { bytes, mimeType: row.mimeType, fileName: row.fileName ?? row.title };
}
