import type { AdminMediaAsset, CreateMediaAssetInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { mediaIsReferenced } from './media-references';
import { decodeUpload, readObject, putObject, deleteObject } from '../lib/storage';

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
  if (input.collection === 'article-covers') {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Use the validated CMS image upload for public images',
    );
  }
  const bytes = decodeUpload(input.contentBase64, input.mimeType);
  const storageKey = await putObject(bytes, input.mimeType);
  try {
    const row = await prisma.mediaAsset.create({
      data: {
        storageKey,
        fileName: input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_'),
        mimeType: input.mimeType,
        sizeBytes: bytes.length,
        alt: input.alt ?? null,
        collection: input.collection ?? null,
        createdById: actorId,
      },
    });
    return toAdmin(row);
  } catch (error) {
    try {
      await deleteObject(storageKey);
    } catch {
      /* Preserve original DB failure. */
    }
    throw error;
  }
}

export async function getMediaFile(
  id: string,
): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  const row = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Image not found');
  const bytes = await readObject(row.storageKey);
  if (!bytes) throw new AppError('NOT_FOUND', 404, 'Image not found');
  return { bytes, mimeType: row.mimeType, fileName: row.fileName };
}

export async function deleteMedia(id: string): Promise<void> {
  const row = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Image not found');
  if (await mediaIsReferenced(id))
    throw new AppError(
      'CONFLICT',
      409,
      'This image is still used by website content. Remove its references before deleting it.',
    );
  await deleteObject(row.storageKey);
  await prisma.mediaAsset.delete({ where: { id } });
}
