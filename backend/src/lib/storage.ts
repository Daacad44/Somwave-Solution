import { randomUUID } from 'node:crypto';
import { ARTICLE_IMAGE_MAX_BYTES, UPLOAD_MAX_BYTES } from '@somwave/shared';
import { AppError } from './http';
import { env } from './env';

const memory = new Map<string, Buffer>();

const ALLOWED_PREFIXES: ReadonlyArray<{ mime: string; magic: number[] }> = [
  { mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
];

export function decodeUpload(contentBase64: string, claimedMime: string): Buffer {
  const bytes = Buffer.from(contentBase64, 'base64');
  if (bytes.length === 0) throw new AppError('VALIDATION_ERROR', 400, 'Faylka waa madhan');
  if (bytes.length > UPLOAD_MAX_BYTES) {
    throw new AppError('VALIDATION_ERROR', 400, 'Faylka wuu ka weyn yahay 25MB');
  }
  const match = ALLOWED_PREFIXES.find((rule) => rule.mime === claimedMime);
  if (!match) {
    throw new AppError('VALIDATION_ERROR', 400, 'Nooca faylka lama oggola');
  }
  if (!match.magic.every((value, index) => bytes[index] === value)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Faylka ma ahan nooca la sheegay');
  }
  return bytes;
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
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY ?? '',
      secretAccessKey: env.S3_SECRET_KEY ?? '',
    },
  });
}

async function storeBytes(key: string, bytes: Buffer, mimeType: string): Promise<void> {
  if (!isSafeStorageKey(key)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Magaca faylka waa khalad');
  }
  if (s3Configured()) {
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
    return;
  }
  if (env.NODE_ENV === 'production') {
    throw new AppError('INTERNAL_ERROR', 503, 'Kaynta faylalka lama diyaarin');
  }
  memory.set(key, bytes);
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
    throw new AppError('VALIDATION_ERROR', 400, 'Fadlan soo geli sawir sax ah.');
  }
  if (bytes.length > ARTICLE_IMAGE_MAX_BYTES) {
    throw new AppError('VALIDATION_ERROR', 400, 'Sawirku waa inuu ka yaraadaa 5MB.');
  }
  const detected = ARTICLE_IMAGE_TYPES.find((rule) => rule.matches(bytes));
  if (!detected || detected.mime !== normalized) {
    throw new AppError('VALIDATION_ERROR', 400, 'Fadlan soo geli sawir JPG, PNG ama WEBP ah.');
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
  if (s3Configured()) {
    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await s3Client();
      const output = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      if (!output.Body) return null;
      return Buffer.from(await output.Body.transformToByteArray());
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (name === 'NoSuchKey' || name === 'NotFound') return null;
      throw new AppError('INTERNAL_ERROR', 503, 'Kaynta faylalka lama diyaarin');
    }
  }
  return memory.get(key) ?? null;
}

export async function deleteObject(key: string): Promise<void> {
  if (!isSafeStorageKey(key)) return;
  if (s3Configured()) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await s3Client();
    await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return;
  }
  memory.delete(key);
}

export function getObject(key: string): Buffer | null {
  return memory.get(key) ?? null;
}
