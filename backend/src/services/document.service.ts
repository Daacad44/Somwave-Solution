import type { AdminDocument, CreateDocumentInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { decodeUpload, getObject, putObject } from '../lib/storage';
import { writeAudit } from '../lib/audit';

function toAdmin(row: {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  clientId: string | null;
  createdAt: Date;
}): AdminDocument {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function ownerWhere(id: string, clientId?: string | null) {
  return { id, deletedAt: null, ...(clientId ? { clientId } : {}) };
}

export async function listDocuments(clientId?: string | null): Promise<AdminDocument[]> {
  const rows = await prisma.clientDocument.findMany({
    where: { deletedAt: null, ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toAdmin);
}

export async function createDocument(
  input: CreateDocumentInput,
  actorId: string,
  scopedClientId?: string | null,
): Promise<AdminDocument> {
  const clientId = scopedClientId ?? input.clientId ?? null;
  if (scopedClientId && input.clientId && input.clientId !== scopedClientId) {
    throw new AppError('NOT_FOUND', 404, 'Dukumeentiga lama helin');
  }
  const bytes = decodeUpload(input.contentBase64, input.mimeType);
  const storageKey = await putObject(bytes, input.mimeType);
  const row = await prisma.clientDocument.create({
    data: {
      title: input.title,
      storageKey,
      mimeType: input.mimeType,
      sizeBytes: bytes.length,
      clientId,
      createdById: actorId,
    },
  });
  await writeAudit({
    actorId,
    action: 'document.create',
    subjectType: 'ClientDocument',
    subjectId: row.id,
  });
  return toAdmin(row);
}

export async function getDocumentFile(
  id: string,
  clientId?: string | null,
): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  const row = await prisma.clientDocument.findFirst({ where: ownerWhere(id, clientId) });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Dukumeentiga lama helin');
  const bytes = getObject(row.storageKey);
  if (!bytes) throw new AppError('NOT_FOUND', 404, 'Dukumeentiga lama helin');
  return { bytes, mimeType: row.mimeType, fileName: row.title };
}

export async function deleteDocument(
  id: string,
  actorId: string,
  clientId?: string | null,
): Promise<void> {
  const row = await prisma.clientDocument.findFirst({ where: ownerWhere(id, clientId) });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Dukumeentiga lama helin');
  await prisma.clientDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({
    actorId,
    action: 'document.delete',
    subjectType: 'ClientDocument',
    subjectId: id,
  });
}
