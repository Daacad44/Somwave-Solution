import type {
  ChangeProjectDocumentationStatusInput,
  CreateProjectDocumentationInput,
  DocumentationVersionRecord,
  DocumentationCommentRecord,
  DocumentationLinks,
  ProjectDocumentation,
  UpdateProjectDocumentationInput,
} from '@somwave/shared';
import { ROLES, UPLOAD_MAX_BYTES } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { putObject, readObject } from '../lib/storage';
import { writeAudit } from '../lib/audit';

type Actor = Express.AuthUserContext;
type Access = 'read' | 'write' | 'approve';

function missing(): never {
  throw new AppError('NOT_FOUND', 404, 'Project documentation not found');
}

export async function assertProjectAccess(
  projectId: string,
  actor: Actor,
  access: Access,
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, managerId: true },
  });
  if (!project) missing();

  // Preserve access for existing projects whose manager predates the new
  // membership table. Other staff need an active project membership.
  const admin = actor.roles.includes(ROLES.SUPER_ADMIN) || actor.roles.includes(ROLES.ADMIN);
  if (admin) return;
  if (project.managerId === actor.id) return;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: actor.id } },
    select: { role: true, removedAt: true },
  });
  if (!member || member.removedAt) missing();
  if (access === 'read') return;
  if (
    access === 'write' &&
    ['ENGINEER', 'LEAD_ENGINEER', 'CONTRIBUTOR', 'MANAGER'].includes(member.role)
  )
    return;
  if (access === 'approve' && member.role === 'MANAGER') return;
  throw new AppError('FORBIDDEN', 403, 'Insufficient project role');
}

export function decodeProjectFile(encoded: string, mimeType: string): Buffer {
  // Buffer.from silently accepts malformed base64, so reject it explicitly.
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid base64 file');
  }
  if (encoded.length > Math.ceil(UPLOAD_MAX_BYTES / 3) * 4 + 4) {
    throw new AppError('VALIDATION_ERROR', 400, 'File exceeds upload limit');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0 || bytes.length > UPLOAD_MAX_BYTES) {
    throw new AppError('VALIDATION_ERROR', 400, 'File is empty or exceeds upload limit');
  }
  const starts = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  const valid =
    (mimeType === 'application/pdf' && starts(0x25, 0x50, 0x44, 0x46)) ||
    (mimeType === 'image/jpeg' && starts(0xff, 0xd8, 0xff)) ||
    (mimeType === 'image/png' && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) ||
    (mimeType === 'image/webp' &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP') ||
    (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      starts(0x50, 0x4b, 0x03, 0x04) &&
      bytes.includes(Buffer.from('[Content_Types].xml')) &&
      bytes.includes(Buffer.from('word/document.xml'))) ||
    (mimeType === 'text/markdown' &&
      !bytes.includes(0) &&
      Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes));
  if (!valid) throw new AppError('VALIDATION_ERROR', 400, 'File content does not match its type');
  return bytes;
}

function toDocument(row: {
  id: string;
  projectId: string;
  title: string;
  category: string | null;
  folder: string | null;
  format: ProjectDocumentation['format'];
  content: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  status: ProjectDocumentation['status'];
  currentVersion: number;
  ownerId: string | null;
  createdById: string;
  updatedById: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectDocumentation {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    category: row.category,
    folder: row.folder,
    format: row.format,
    content: row.content,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    currentVersion: row.currentVersion,
    ownerId: row.ownerId,
    createdById: row.createdById,
    updatedById: row.updatedById,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toVersion(row: {
  id: string;
  version: number;
  title: string;
  content: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  status: DocumentationVersionRecord['status'];
  approvedById: string | null;
  approvedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
}): DocumentationVersionRecord {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    content: row.content,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getExisting(projectId: string, documentId: string) {
  const row = await prisma.projectDocumentation.findFirst({
    where: { id: documentId, projectId, deletedAt: null },
  });
  if (!row) missing();
  return row;
}

export async function listProjectDocumentation(
  projectId: string,
  actor: Actor,
  filter: {
    search?: string;
    category?: string;
    folder?: string;
    status?: ProjectDocumentation['status'];
  },
): Promise<ProjectDocumentation[]> {
  await assertProjectAccess(projectId, actor, 'read');
  const rows = await prisma.projectDocumentation.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.folder ? { folder: filter.folder } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: 'insensitive' } },
              { content: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(toDocument);
}

export async function getProjectDocumentation(projectId: string, documentId: string, actor: Actor) {
  await assertProjectAccess(projectId, actor, 'read');
  return toDocument(await getExisting(projectId, documentId));
}

export async function listDocumentationAttachments(
  projectId: string,
  documentId: string,
  actor: Actor,
): Promise<ProjectDocumentation[]> {
  await assertProjectAccess(projectId, actor, 'read');
  const document = await getExisting(projectId, documentId);
  if (document.format === 'FILE')
    throw new AppError('VALIDATION_ERROR', 400, 'A file cannot own attachments');
  const links = await prisma.documentAttachmentLink.findMany({
    where: { documentId, file: { projectId, deletedAt: null, format: 'FILE' } },
    include: { file: true },
    orderBy: { createdAt: 'asc' },
  });
  return links.map((link) => toDocument(link.file));
}

export async function addDocumentationAttachment(
  projectId: string,
  documentId: string,
  fileDocumentId: string,
  actor: Actor,
): Promise<ProjectDocumentation> {
  await assertProjectAccess(projectId, actor, 'write');
  const [document, file] = await Promise.all([
    getExisting(projectId, documentId),
    getExisting(projectId, fileDocumentId),
  ]);
  if (document.format === 'FILE' || file.format !== 'FILE')
    throw new AppError('VALIDATION_ERROR', 400, 'Attach a file to a text document');
  const existingCount = await prisma.documentAttachmentLink.count({ where: { documentId } });
  if (existingCount >= 50)
    throw new AppError('VALIDATION_ERROR', 400, 'Document attachment limit reached');
  await prisma.documentAttachmentLink.upsert({
    where: { documentId_fileDocumentId: { documentId, fileDocumentId } },
    create: { documentId, fileDocumentId },
    update: {},
  });
  await writeAudit({
    actorId: actor.id,
    action: 'projectDocumentation.attachment.add',
    subjectType: 'ProjectDocumentation',
    subjectId: documentId,
  });
  return toDocument(file);
}

export async function removeDocumentationAttachment(
  projectId: string,
  documentId: string,
  fileDocumentId: string,
  actor: Actor,
): Promise<void> {
  await assertProjectAccess(projectId, actor, 'write');
  await getExisting(projectId, documentId);
  const result = await prisma.documentAttachmentLink.deleteMany({
    where: { documentId, fileDocumentId, file: { projectId } },
  });
  if (!result.count) throw new AppError('NOT_FOUND', 404, 'Document attachment not found');
  await writeAudit({
    actorId: actor.id,
    action: 'projectDocumentation.attachment.remove',
    subjectType: 'ProjectDocumentation',
    subjectId: documentId,
  });
}

export async function createProjectDocumentation(
  projectId: string,
  actor: Actor,
  input: CreateProjectDocumentationInput,
): Promise<ProjectDocumentation> {
  await assertProjectAccess(projectId, actor, 'write');
  if (input.ownerId) await assertOwner(projectId, input.ownerId);
  const bytes = input.contentBase64
    ? decodeProjectFile(input.contentBase64, input.mimeType!)
    : null;
  const storageKey = bytes ? await putObject(bytes, input.mimeType!) : null;
  const row = await prisma.projectDocumentation.create({
    data: {
      projectId,
      title: input.title,
      category: input.category ?? null,
      folder: input.folder ?? null,
      format: input.format,
      content: input.format === 'FILE' ? null : (input.content ?? null),
      fileName: input.fileName ?? null,
      storageKey,
      mimeType: input.mimeType ?? null,
      sizeBytes: bytes?.length ?? null,
      status: 'DRAFT',
      currentVersion: 1,
      ownerId: input.ownerId ?? null,
      createdById: actor.id,
      versions: {
        create: {
          version: 1,
          title: input.title,
          content: input.format === 'FILE' ? null : (input.content ?? null),
          fileName: input.fileName ?? null,
          storageKey,
          mimeType: input.mimeType ?? null,
          sizeBytes: bytes?.length ?? null,
          status: 'DRAFT',
          createdById: actor.id,
        },
      },
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'projectDocumentation.create',
    subjectType: 'ProjectDocumentation',
    subjectId: row.id,
  });
  return toDocument(row);
}

async function assertOwner(projectId: string, ownerId: string): Promise<void> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: ownerId } },
    select: { id: true, removedAt: true },
  });
  if (!member || member.removedAt)
    throw new AppError('VALIDATION_ERROR', 400, 'Owner must be an active project member');
}

export async function updateProjectDocumentation(
  projectId: string,
  documentId: string,
  actor: Actor,
  input: UpdateProjectDocumentationInput,
): Promise<ProjectDocumentation> {
  await assertProjectAccess(projectId, actor, 'write');
  const old = await getExisting(projectId, documentId);
  if (old.status === 'ARCHIVED')
    throw new AppError('CONFLICT', 409, 'Archived documentation cannot be edited');
  if (input.ownerId) await assertOwner(projectId, input.ownerId);
  if (old.format === 'FILE' && input.content !== undefined) {
    throw new AppError('VALIDATION_ERROR', 400, 'File documents require a file upload');
  }
  if (old.format !== 'FILE' && input.contentBase64) {
    throw new AppError('VALIDATION_ERROR', 400, 'Text documents cannot receive file uploads');
  }
  const bytes = input.contentBase64
    ? decodeProjectFile(input.contentBase64, input.mimeType!)
    : null;
  const storageKey = bytes ? await putObject(bytes, input.mimeType!) : old.storageKey;
  const nextStatus = old.status === 'APPROVED' ? 'DRAFT' : old.status;
  const row = await prisma.$transaction(async (tx) => {
    const changed = await tx.projectDocumentation.updateMany({
      where: { id: documentId, projectId, deletedAt: null, currentVersion: input.expectedVersion },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.folder !== undefined ? { folder: input.folder } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(bytes
          ? {
              storageKey,
              mimeType: input.mimeType,
              fileName: input.fileName,
              sizeBytes: bytes.length,
            }
          : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        status: nextStatus,
        approvedById: null,
        approvedAt: null,
        updatedById: actor.id,
        currentVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1)
      throw new AppError('CONFLICT', 409, 'Document changed; reload before editing');
    const current = await tx.projectDocumentation.findUniqueOrThrow({ where: { id: documentId } });
    await tx.documentationVersion.create({
      data: {
        documentId,
        version: current.currentVersion,
        title: current.title,
        content: current.content,
        storageKey: current.storageKey,
        fileName: current.fileName,
        mimeType: current.mimeType,
        sizeBytes: current.sizeBytes,
        status: current.status,
        createdById: actor.id,
      },
    });
    return current;
  });
  await writeAudit({
    actorId: actor.id,
    action: 'projectDocumentation.update',
    subjectType: 'ProjectDocumentation',
    subjectId: documentId,
  });
  return toDocument(row);
}

export async function changeProjectDocumentationStatus(
  projectId: string,
  documentId: string,
  actor: Actor,
  input: ChangeProjectDocumentationStatusInput,
): Promise<ProjectDocumentation> {
  await assertProjectAccess(projectId, actor, input.status === 'APPROVED' ? 'approve' : 'write');
  const old = await getExisting(projectId, documentId);
  const allowed: Record<ProjectDocumentation['status'], readonly ProjectDocumentation['status'][]> =
    {
      DRAFT: ['IN_REVIEW'],
      IN_REVIEW: ['DRAFT', 'APPROVED'],
      APPROVED: ['ARCHIVED'],
      ARCHIVED: [],
    };
  if (!allowed[old.status].includes(input.status)) {
    throw new AppError('CONFLICT', 409, 'Invalid documentation status transition');
  }
  const approvedAt = input.status === 'APPROVED' ? new Date() : null;
  const approvedById = input.status === 'APPROVED' ? actor.id : null;
  const row = await prisma.$transaction(async (tx) => {
    const changed = await tx.projectDocumentation.updateMany({
      where: {
        id: documentId,
        projectId,
        deletedAt: null,
        currentVersion: input.expectedVersion,
        status: old.status,
      },
      data: {
        status: input.status,
        approvedAt,
        approvedById,
        updatedById: actor.id,
        currentVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1)
      throw new AppError('CONFLICT', 409, 'Document changed; reload before updating status');
    const current = await tx.projectDocumentation.findUniqueOrThrow({ where: { id: documentId } });
    await tx.documentationVersion.create({
      data: {
        documentId,
        version: current.currentVersion,
        title: current.title,
        content: current.content,
        storageKey: current.storageKey,
        fileName: current.fileName,
        mimeType: current.mimeType,
        sizeBytes: current.sizeBytes,
        status: current.status,
        approvedAt,
        approvedById,
        createdById: actor.id,
      },
    });
    return current;
  });
  await writeAudit({
    actorId: actor.id,
    action: `projectDocumentation.${input.status.toLowerCase()}`,
    subjectType: 'ProjectDocumentation',
    subjectId: documentId,
  });
  return toDocument(row);
}

export async function listProjectDocumentationVersions(
  projectId: string,
  documentId: string,
  actor: Actor,
): Promise<DocumentationVersionRecord[]> {
  await assertProjectAccess(projectId, actor, 'read');
  await getExisting(projectId, documentId);
  const rows = await prisma.documentationVersion.findMany({
    where: { documentId },
    orderBy: { version: 'desc' },
  });
  return rows.map(toVersion);
}

export async function getProjectDocumentationFile(
  projectId: string,
  documentId: string,
  actor: Actor,
  version?: number,
): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  await assertProjectAccess(projectId, actor, 'read');
  const current = await getExisting(projectId, documentId);
  const row = version
    ? await prisma.documentationVersion.findUnique({
        where: { documentId_version: { documentId, version } },
      })
    : current;
  if (!row?.storageKey || !row.mimeType) missing();
  const bytes = await readObject(row.storageKey);
  if (!bytes) missing();
  return { bytes, mimeType: row.mimeType, fileName: row.fileName ?? row.title };
}

export async function deleteProjectDocumentation(
  projectId: string,
  documentId: string,
  actor: Actor,
): Promise<void> {
  await assertProjectAccess(projectId, actor, 'approve');
  await getExisting(projectId, documentId);
  await prisma.projectDocumentation.update({
    where: { id: documentId },
    data: { deletedAt: new Date(), updatedById: actor.id },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'projectDocumentation.delete',
    subjectType: 'ProjectDocumentation',
    subjectId: documentId,
  });
}

export async function listDocumentationComments(
  projectId: string,
  documentId: string,
  actor: Actor,
): Promise<DocumentationCommentRecord[]> {
  await assertProjectAccess(projectId, actor, 'read');
  await getExisting(projectId, documentId);
  const rows = await prisma.documentationComment.findMany({
    where: { documentId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createDocumentationComment(
  projectId: string,
  documentId: string,
  actor: Actor,
  body: string,
): Promise<DocumentationCommentRecord> {
  await assertProjectAccess(projectId, actor, 'read');
  await getExisting(projectId, documentId);
  const row = await prisma.documentationComment.create({
    data: { documentId, authorId: actor.id, body },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'projectDocumentation.comment.create',
    subjectType: 'DocumentationComment',
    subjectId: row.id,
  });
  return {
    id: row.id,
    documentId: row.documentId,
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateDocumentationComment(
  projectId: string,
  documentId: string,
  commentId: string,
  actor: Actor,
  body: string,
): Promise<DocumentationCommentRecord> {
  await assertProjectAccess(projectId, actor, 'read');
  await getExisting(projectId, documentId);
  const row = await prisma.documentationComment.findFirst({
    where: { id: commentId, documentId, deletedAt: null },
  });
  if (!row) missing();
  if (row.authorId !== actor.id)
    throw new AppError('FORBIDDEN', 403, 'Only the author can edit this comment');
  const updated = await prisma.documentationComment.update({
    where: { id: commentId },
    data: { body },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'projectDocumentation.comment.update',
    subjectType: 'DocumentationComment',
    subjectId: commentId,
  });
  return {
    id: updated.id,
    documentId: updated.documentId,
    authorId: updated.authorId,
    body: updated.body,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteDocumentationComment(
  projectId: string,
  documentId: string,
  commentId: string,
  actor: Actor,
): Promise<void> {
  await assertProjectAccess(projectId, actor, 'read');
  await getExisting(projectId, documentId);
  const row = await prisma.documentationComment.findFirst({
    where: { id: commentId, documentId, deletedAt: null },
  });
  if (!row) missing();
  if (row.authorId !== actor.id)
    throw new AppError('FORBIDDEN', 403, 'Only the author can delete this comment');
  await prisma.documentationComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'projectDocumentation.comment.delete',
    subjectType: 'DocumentationComment',
    subjectId: commentId,
  });
}

export async function listDocumentationLinks(
  projectId: string,
  documentId: string,
  actor: Actor,
): Promise<DocumentationLinks> {
  await assertProjectAccess(projectId, actor, 'read');
  await getExisting(projectId, documentId);
  const [taskLinks, milestoneLinks] = await Promise.all([
    prisma.documentTaskLink.findMany({
      where: { documentId, task: { deletedAt: null } },
      select: { taskId: true },
    }),
    prisma.documentMilestoneLink.findMany({
      where: { documentId, milestone: { deletedAt: null } },
      select: { milestoneId: true },
    }),
  ]);
  return {
    taskIds: taskLinks.map((link) => link.taskId),
    milestoneIds: milestoneLinks.map((link) => link.milestoneId),
  };
}

export async function changeDocumentationLink(
  projectId: string,
  documentId: string,
  actor: Actor,
  target: 'task' | 'milestone',
  targetId: string,
  add: boolean,
): Promise<DocumentationLinks> {
  await assertProjectAccess(projectId, actor, 'write');
  await getExisting(projectId, documentId);
  if (target === 'task') {
    const found = await prisma.task.findFirst({
      where: { id: targetId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new AppError('NOT_FOUND', 404, 'Project task not found');
    if (add) {
      await prisma.documentTaskLink.upsert({
        where: { documentId_taskId: { documentId, taskId: targetId } },
        create: { documentId, taskId: targetId },
        update: {},
      });
    } else {
      await prisma.documentTaskLink.deleteMany({ where: { documentId, taskId: targetId } });
    }
  } else {
    const found = await prisma.milestone.findFirst({
      where: { id: targetId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new AppError('NOT_FOUND', 404, 'Project milestone not found');
    if (add) {
      await prisma.documentMilestoneLink.upsert({
        where: { documentId_milestoneId: { documentId, milestoneId: targetId } },
        create: { documentId, milestoneId: targetId },
        update: {},
      });
    } else {
      await prisma.documentMilestoneLink.deleteMany({
        where: { documentId, milestoneId: targetId },
      });
    }
  }
  await writeAudit({
    actorId: actor.id,
    action: `projectDocumentation.${target}.${add ? 'link' : 'unlink'}`,
    subjectType: 'ProjectDocumentation',
    subjectId: documentId,
  });
  return listDocumentationLinks(projectId, documentId, actor);
}

export async function listDocumentationFolders(projectId: string, actor: Actor): Promise<string[]> {
  await assertProjectAccess(projectId, actor, 'read');
  const rows = await prisma.projectDocumentation.findMany({
    where: { projectId, deletedAt: null, folder: { not: null } },
    select: { folder: true },
    distinct: ['folder'],
    orderBy: { folder: 'asc' },
  });
  return rows.flatMap((row) => (row.folder ? [row.folder] : []));
}

export async function renameDocumentationFolder(
  projectId: string,
  actor: Actor,
  from: string,
  to: string,
): Promise<{ updated: number }> {
  await assertProjectAccess(projectId, actor, 'write');
  if (from === to) throw new AppError('VALIDATION_ERROR', 400, 'Choose a different folder name');
  const result = await prisma.projectDocumentation.updateMany({
    where: { projectId, folder: from, deletedAt: null },
    data: { folder: to, updatedById: actor.id },
  });
  if (!result.count) throw new AppError('NOT_FOUND', 404, 'Folder not found');
  await writeAudit({
    actorId: actor.id,
    action: 'projectDocumentation.folder.rename',
    subjectType: 'Project',
    subjectId: projectId,
  });
  return { updated: result.count };
}

/** Turn approved requirements into reviewable draft tasks; no task becomes active here. */
export async function proposeTasksFromDocumentation(
  projectId: string,
  documentId: string,
  actor: Actor,
) {
  await assertProjectAccess(projectId, actor, 'write');
  const document = await getExisting(projectId, documentId);
  if (document.status !== 'APPROVED' || document.format === 'FILE' || !document.content) {
    throw new AppError('CONFLICT', 409, 'An approved text document is required');
  }
  const text =
    document.format === 'RICH_TEXT'
      ? document.content.replace(/<\/(?:h[1-6]|p|li)>/gi, '\n').replace(/<[^>]*>/g, ' ')
      : document.content;
  const titles = [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) =>
          line
            .trim()
            .replace(/^#{1,6}\s*|^[-*]\s*(?:\[[ xX]\]\s*)?/, '')
            .trim(),
        )
        .filter((line) => line.length >= 5 && line.length <= 200),
    ),
  ].slice(0, 50);
  if (!titles.length)
    throw new AppError('VALIDATION_ERROR', 400, 'Document has no usable task lines');
  const rows = await prisma.$transaction(async (tx) => {
    const existing = await tx.task.findMany({
      where: { projectId, deletedAt: null, documentLinks: { some: { documentId } } },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((task) => task.title));
    const proposals = [];
    for (const title of titles) {
      if (existingTitles.has(title)) continue;
      const task = await tx.task.create({
        data: {
          projectId,
          title,
          description: `Proposed from documentation: ${document.title}`,
          type: 'FEATURE',
          priority: 'MEDIUM',
          status: 'TODO',
          reporterId: actor.id,
          approvalStatus: 'DRAFT',
          reviewRequired: true,
          documentLinks: { create: { documentId } },
        },
        select: { id: true, title: true, approvalStatus: true },
      });
      proposals.push(task);
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'projectDocumentation.proposeTasks',
        subjectType: 'ProjectDocumentation',
        subjectId: documentId,
      },
    });
    return proposals;
  });
  return rows;
}
