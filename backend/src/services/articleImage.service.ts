import { randomUUID } from 'node:crypto';
import type { UploadArticleImageInput, UploadedArticleImage } from '@somwave/shared';
import {
  articleImageExtension,
  articleImageIdFromUrl,
  isStoredArticleImageUrl,
} from '@somwave/shared';
import { mediaIsReferenced } from './media-references';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { logger } from '../lib/logger';
import { writeAudit } from '../lib/audit';
import {
  decodeArticleImage,
  deleteObject,
  putPublicImage,
  readObject,
  storageStatus,
} from '../lib/storage';

/** Collection for every public website image (articles, portfolio, team, ...). */
export const ARTICLE_COVER_COLLECTION = 'article-covers';

const PUBLIC_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
};

function safeFileName(original: string, extension: string): string {
  const base = original.replace(/\\/g, '/').split('/').pop() ?? 'image';
  const stripped = base.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
  const withoutExt = stripped.replace(/\.(jpe?g|png|webp|gif)$/i, '');
  return `${withoutExt || 'image'}.${extension}`;
}

export async function uploadArticleImage(
  input: UploadArticleImageInput,
  actorId: string,
  urlFor: (id: string) => string,
): Promise<UploadedArticleImage> {
  const decoded = decodeArticleImage(input.contentBase64, input.mimeType);
  const extension = articleImageExtension(input.fileName);
  if (!EXTENSIONS[decoded.mimeType]?.includes(extension)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Please upload a JPG, PNG, WebP, or GIF image.');
  }
  const module = input.module ?? 'articles';
  // The record id is the remote file name, so a delivery URL maps back to its row.
  const id = randomUUID().replace(/-/g, '');
  const stored = await putPublicImage(
    decoded.bytes,
    decoded.mimeType,
    module,
    `${id}.${decoded.extension}`,
  );
  const filename = safeFileName(input.fileName, decoded.extension);
  try {
    await prisma.mediaAsset.create({
      data: {
        id,
        storageKey: stored.storageKey,
        fileName: filename,
        mimeType: decoded.mimeType,
        sizeBytes: decoded.bytes.length,
        collection: ARTICLE_COVER_COLLECTION,
        provider: stored.provider === 'imagekit' ? 'imagekit' : storageStatus().provider,
        providerFileId: stored.fileId,
        url: stored.url,
        width: stored.width,
        height: stored.height,
        folder: stored.folder ?? module,
        createdById: actorId,
      },
    });
  } catch (err) {
    try {
      await deleteObject(stored.storageKey);
    } catch {
      // Keep the database error. A leftover remote file is safer than hiding it.
    }
    throw err;
  }
  // The image is stored and recorded; a failed audit write must not report failure.
  await writeAudit({
    actorId,
    action: 'media.image.uploaded',
    subjectType: 'MediaAsset',
    subjectId: id,
    after: {
      module,
      provider: stored.provider,
      mimeType: decoded.mimeType,
      size: decoded.bytes.length,
    },
  }).catch((err: unknown) => logger.warn({ err, mediaId: id }, 'image upload audit failed'));
  return {
    url: stored.url ?? urlFor(id),
    filename,
    size: decoded.bytes.length,
    mimeType: decoded.mimeType,
    width: stored.width,
    height: stored.height,
  };
}

/** Legacy API image URLs keep working: ImageKit rows redirect to the CDN. */
export async function readPublicArticleImage(
  id: string,
): Promise<{ redirect: string } | { bytes: Buffer; mimeType: string }> {
  if (!/^[a-z0-9]+$/i.test(id)) throw new AppError('NOT_FOUND', 404, 'Image not found');
  const row = await prisma.mediaAsset.findFirst({
    where: { id, collection: ARTICLE_COVER_COLLECTION },
  });
  if (!row || !PUBLIC_IMAGE_MIME_TYPES.includes(row.mimeType)) {
    throw new AppError('NOT_FOUND', 404, 'Image not found');
  }
  if (row.url) return { redirect: row.url };
  const bytes = await readObject(row.storageKey);
  if (!bytes) throw new AppError('NOT_FOUND', 404, 'Image not found');
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
    throw new AppError('VALIDATION_ERROR', 400, 'Please upload a JPG, PNG, WebP, or GIF image.');
  }
  const id = articleImageIdFromUrl(trimmed);
  const asset = id
    ? await prisma.mediaAsset.findFirst({ where: { id, collection: ARTICLE_COVER_COLLECTION } })
    : null;
  // A CDN URL must be exactly the one recorded at upload, not a look-alike host.
  if (!asset || (!trimmed.includes('/api/v1/public/article-images/') && asset.url !== trimmed)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Image not found. Please upload it again.');
  }
  return trimmed;
}

/** Deletes the remote file only after no website content still references it. */
export async function releaseArticleImageUrl(
  url: string | null | undefined,
  actorId?: string | null,
): Promise<void> {
  if (!url) return;
  const id = articleImageIdFromUrl(url);
  if (!id) return;
  if (await mediaIsReferenced(id)) return;
  const row = await prisma.mediaAsset.findFirst({
    where: { id, collection: ARTICLE_COVER_COLLECTION },
  });
  if (!row) return;
  try {
    await deleteObject(row.storageKey);
    await prisma.mediaAsset.delete({ where: { id: row.id } });
    await writeAudit({
      actorId: actorId ?? null,
      action: 'media.image.deleted',
      subjectType: 'MediaAsset',
      subjectId: row.id,
      before: { provider: row.provider, folder: row.folder, fileName: row.fileName },
    });
  } catch (err) {
    // The record stays, so a later release or the reconciliation script can retry.
    logger.warn({ err, mediaId: row.id }, 'public image cleanup failed');
  }
}

/** Releases images a save removed (replaced cover, dropped gallery item, ...). */
export async function releaseRemovedImages(
  before: ReadonlyArray<string | null | undefined>,
  after: ReadonlyArray<string | null | undefined>,
  actorId?: string | null,
): Promise<void> {
  const kept = new Set(after.filter((url): url is string => Boolean(url)));
  for (const url of new Set(before)) {
    if (!url || kept.has(url)) continue;
    // The content save already succeeded; cleanup must never turn it into an error.
    await releaseArticleImageUrl(url, actorId).catch((err: unknown) =>
      logger.warn({ err }, 'public image release failed'),
    );
  }
}
