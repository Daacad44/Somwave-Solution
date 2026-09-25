import type { AdminMediaAsset, CreateMediaAssetInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { decodeUpload, getObject, putObject } from '../lib/storage';

function toAdmin(row: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  alt: string | null;
  collection: string | null;
  createdAt: Date;
}): AdminMediaAsset {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listMedia(): Promise<AdminMediaAsset[]> {
  const rows = await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toAdmin);
}

export async function createMedia(
  input: CreateMediaAssetInput,
  actorId: string,
): Promise<AdminMediaAsset> {
  const bytes = decodeUpload(input.contentBase64, input.mimeType);
  const storageKey = await putObject(bytes, input.mimeType);
  const row = await prisma.mediaAsset.create({
    data: {
      storageKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: bytes.length,
      alt: input.alt ?? null,
      collection: input.collection ?? null,
      createdById: actorId,
    },
  });
  return toAdmin(row);
}

export async function getMediaFile(
  id: string,
): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  const row = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Sawirka lama helin');
  const bytes = getObject(row.storageKey);
  if (!bytes) throw new AppError('NOT_FOUND', 404, 'Sawirka lama helin');
  return { bytes, mimeType: row.mimeType, fileName: row.fileName };
}

export async function deleteMedia(id: string): Promise<void> {
  const row = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Sawirka lama helin');
  await prisma.mediaAsset.delete({ where: { id } });
}
