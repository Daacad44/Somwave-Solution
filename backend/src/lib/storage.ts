import { randomUUID } from 'node:crypto';
import { mkdir, open, writeFile, unlink, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { logger } from './logger';
import { correlationId } from './requestContext';
import { ARTICLE_IMAGE_MAX_BYTES, UPLOAD_MAX_BYTES } from '@somwave/shared';
import { AppError } from './http';
import { env } from './env';

const memory = new Map<string, Buffer>();

/** Shared attachments accept PDF and the same signed image formats as CMS. */
export function decodeUpload(contentBase64: string, claimedMime: string): Buffer {
  const bytes = Buffer.from(contentBase64, 'base64');
  if (bytes.length === 0) throw new AppError('VALIDATION_ERROR', 400, 'File is empty');
  if (bytes.length > UPLOAD_MAX_BYTES)
    throw new AppError('VALIDATION_ERROR', 400, 'File exceeds 25 MB');
  if (claimedMime === 'application/pdf') {
    if (bytes.toString('ascii', 0, 5) !== '%PDF-') {
      throw new AppError('VALIDATION_ERROR', 400, 'File content does not match its type');
    }
  } else if (
    !ARTICLE_IMAGE_TYPES.some((rule) => rule.mime === claimedMime && rule.matches(bytes))
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'File content does not match an allowed PDF, JPG, PNG or WebP type',
    );
  }
  return bytes;
}

export function storageStatus(): { provider: string; configured: boolean; durable: boolean } {
  const provider =
    env.STORAGE_PROVIDER ??
    (s3Configured() ? 's3' : env.NODE_ENV === 'production' ? 'unconfigured' : 'memory');
  const configured =
    provider === 's3'
      ? s3Configured()
      : provider === 'filesystem'
        ? Boolean(env.STORAGE_LOCAL_PATH && isAbsolute(env.STORAGE_LOCAL_PATH))
        : provider === 'memory' && env.NODE_ENV !== 'production';
  return { provider, configured, durable: configured && provider !== 'memory' };
}

async function localPath(key: string): Promise<string> {
  const root = env.STORAGE_LOCAL_PATH;
  if (!root || !isAbsolute(root))
    throw new AppError('INTERNAL_ERROR', 503, 'File storage is unavailable');
  await mkdir(root, { recursive: true, mode: 0o700 });
  const canonicalRoot = await realpath(root);
  const folder = resolve(canonicalRoot, dirname(key));
  await mkdir(folder, { recursive: true, mode: 0o700 });
  // Refuse a symlinked object directory; safe keys alone do not protect mounts.
  if ((await realpath(folder)) !== folder)
    throw new AppError('INTERNAL_ERROR', 503, 'File storage is unavailable');
  return resolve(folder, key.split('/').at(-1)!);
}

async function storageOperation<T>(
  operation: string,
  key: string,
  run: (provider: string) => Promise<T>,
): Promise<T> {
  const started = Date.now();
  const status = storageStatus();
  try {
    if (!status.configured)
      throw new AppError('INTERNAL_ERROR', 503, 'File storage is unavailable');
    const result = await run(status.provider);
    logger.info(
      {
        requestId: correlationId(),
        operation,
        provider: status.provider,
        module: key.startsWith('article-images/') ? 'cms-images' : 'attachments',
        httpStatus: 200,
        durationMs: Date.now() - started,
      },
      'storage operation',
    );
    return result;
  } catch (error) {
    const category =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : error && typeof error === 'object' && 'name' in error
          ? String(error.name)
          : 'PROVIDER_ERROR';
    logger.error(
      {
        requestId: correlationId(),
        operation,
        provider: status.provider,
        errorCategory: category,
        httpStatus: 503,
        durationMs: Date.now() - started,
      },
      'storage operation failed',
    );
    throw new AppError('INTERNAL_ERROR', 503, 'File storage is unavailable');
  }
}

const SAFE_KEY = /^(obj\/[0-9a-f-]{36}|article-images\/[0-9a-f-]{36}\.(jpg|png|webp))$/;

function isSafeStorageKey(key: string): boolean {
  return !key.includes('..') && !key.includes('\\') && SAFE_KEY.test(key);
}

function s3Configured(): boolean {
  return Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);
}

async function s3Client() {
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({
    region: env.S3_REGION ?? 'us-east-1',
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY ?? '',
      secretAccessKey: env.S3_SECRET_KEY ?? '',
    },
  });
}

async function storeBytes(key: string, bytes: Buffer, mimeType: string): Promise<void> {
  if (!isSafeStorageKey(key)) throw new AppError('VALIDATION_ERROR', 400, 'Invalid storage key');
  await storageOperation('upload', key, async (provider) => {
    if (provider === 's3') {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await s3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: bytes,
          ContentType: mimeType,
        }),
      );
    } else if (provider === 'filesystem') {
      // O_EXCL prevents overwriting existing objects or following object symlinks.
      await writeFile(await localPath(key), bytes, { flag: 'wx', mode: 0o600 });
    } else memory.set(key, bytes);
  });
}

export async function putObject(bytes: Buffer, mimeType: string): Promise<string> {
  const key = `obj/${randomUUID()}`;
  await storeBytes(key, bytes, mimeType);
  return key;
}

const ARTICLE_IMAGE_TYPES: ReadonlyArray<{
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  matches: (bytes: Buffer) => boolean;
}> = [
  {
    mime: 'image/jpeg',
    extension: 'jpg',
    matches: (bytes) =>
      bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    mime: 'image/png',
    extension: 'png',
    matches: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    matches: (bytes) =>
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP',
  },
];

/** Magic-byte check for article covers. The claimed type must match the file. */
export function decodeArticleImage(
  contentBase64: string,
  claimedMime: string,
): {
  bytes: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
} {
  const normalized = claimedMime === 'image/jpg' ? 'image/jpeg' : claimedMime;
  const bytes = Buffer.from(contentBase64, 'base64');
  if (bytes.length === 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'Please upload a valid image.');
  }
  if (bytes.length > ARTICLE_IMAGE_MAX_BYTES) {
    throw new AppError('VALIDATION_ERROR', 400, 'The image must be smaller than 5 MB.');
  }
  const detected = ARTICLE_IMAGE_TYPES.find((rule) => rule.matches(bytes));
  if (!detected || detected.mime !== normalized) {
    throw new AppError('VALIDATION_ERROR', 400, 'Please upload a JPG, PNG, or WebP image.');
  }
  return { bytes, mimeType: detected.mime, extension: detected.extension };
}

export async function putArticleImage(
  bytes: Buffer,
  mimeType: string,
  extension: 'jpg' | 'png' | 'webp',
): Promise<string> {
  const key = `article-images/${randomUUID()}.${extension}`;
  await storeBytes(key, bytes, mimeType);
  return key;
}

export async function readObject(key: string): Promise<Buffer | null> {
  if (!isSafeStorageKey(key)) return null;
  return storageOperation('retrieve', key, async (provider) => {
    try {
      if (provider === 's3') {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const client = await s3Client();
        const output = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
        return output.Body ? Buffer.from(await output.Body.transformToByteArray()) : null;
      }
      if (provider === 'filesystem') {
        const path = await localPath(key);
        // Refuse object symlinks atomically, including swaps after path resolution.
        const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          return await handle.readFile();
        } finally {
          await handle.close();
        }
      }
      return memory.get(key) ?? null;
    } catch (error) {
      const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (name === 'NoSuchKey' || name === 'NotFound' || code === 'ENOENT') return null;
      throw error;
    }
  });
}

export async function deleteObject(key: string): Promise<void> {
  if (!isSafeStorageKey(key)) return;
  await storageOperation('delete', key, async (provider) => {
    if (provider === 's3') {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await s3Client();
      await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    } else if (provider === 'filesystem') {
      try {
        await unlink(await localPath(key));
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
          throw error;
      }
    } else memory.delete(key);
  });
}

export function getObject(key: string): Buffer | null {
  return memory.get(key) ?? null;
}
