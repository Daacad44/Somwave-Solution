import type { UploadArticleImageInput, UploadedArticleImage } from '@somwave/shared';
import {
  articleImageExtension,
  articleImageIdFromUrl,
  isStoredArticleImageUrl,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { logger } from '../lib/logger';
import { decodeArticleImage, deleteObject, putArticleImage, readObject } from '../lib/storage';

export const ARTICLE_COVER_COLLECTION = 'article-covers';

const EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

function safeFileName(original: string, extension: string): string {
  const base = original.replace(/\\/g, '/').split('/').pop() ?? 'sawir';
  const stripped = base.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
  const withoutExt = stripped.replace(/\.(jpe?g|png|webp)$/i, '');
  return `${withoutExt || 'sawir'}.${extension}`;
}

export async function uploadArticleImage(
  input: UploadArticleImageInput,
  actorId: string,
  urlFor: (id: string) => string,
): Promise<UploadedArticleImage> {
  const decoded = decodeArticleImage(input.contentBase64, input.mimeType);
  const extension = articleImageExtension(input.fileName);
  if (!EXTENSIONS[decoded.mimeType]?.includes(extension)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Fadlan soo geli sawir JPG, PNG ama WEBP ah.');
  }
  const storageKey = await putArticleImage(decoded.bytes, decoded.mimeType, decoded.extension);
  try {
    const filename = safeFileName(input.fileName, decoded.extension);
    const row = await prisma.mediaAsset.create({
      data: {
        storageKey,
        fileName: filename,
        mimeType: decoded.mimeType,
        sizeBytes: decoded.bytes.length,
        collection: ARTICLE_COVER_COLLECTION,
        createdById: actorId,
      },
    });
    return {
      url: urlFor(row.id),
      filename,
      size: decoded.bytes.length,
      mimeType: decoded.mimeType,
    };
  } catch (err) {
    try {
      await deleteObject(storageKey);
    } catch {
      // Keep the database error. A leftover object is safer than hiding it.
    }
    throw err;
  }
}

export async function readPublicArticleImage(
  id: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  if (!/^[a-z0-9]+$/i.test(id)) throw new AppError('NOT_FOUND', 404, 'Sawirka lama helin');
  const row = await prisma.mediaAsset.findFirst({
    where: { id, collection: ARTICLE_COVER_COLLECTION },
  });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Sawirka lama helin');
  const bytes = await readObject(row.storageKey);
  if (!bytes) throw new AppError('NOT_FOUND', 404, 'Sawirka lama helin');
  return { bytes, mimeType: row.mimeType };
}

/** Blank clears the cover. A new value must be an uploaded article image. */
export async function resolveArticleCover(
  value: string | null | undefined,
  previous?: string | null,
): Promise<string | null> {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (previous && trimmed === previous) return previous;
  if (!isStoredArticleImageUrl(trimmed)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Fadlan soo geli sawir JPG, PNG ama WEBP ah.');
  }
  const id = articleImageIdFromUrl(trimmed);
  const asset = id
    ? await prisma.mediaAsset.findFirst({ where: { id, collection: ARTICLE_COVER_COLLECTION } })
    : null;
  if (!asset) {
    throw new AppError('VALIDATION_ERROR', 400, 'Sawirka lama helin. Fadlan mar kale soo geli.');
  }
  return trimmed;
}

/** Deletes storage only after no article still references the image. */
export async function releaseArticleImageUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const id = articleImageIdFromUrl(url);
  if (!id) return;
  const stillUsed = await prisma.post.count({ where: { coverImage: { contains: id } } });
  if (stillUsed > 0) return;
  const row = await prisma.mediaAsset.findFirst({
    where: { id, collection: ARTICLE_COVER_COLLECTION },
  });
  if (!row) return;
  try {
    await deleteObject(row.storageKey);
    await prisma.mediaAsset.delete({ where: { id: row.id } });
  } catch (err) {
    logger.warn({ err }, 'article image cleanup failed');
  }
}
