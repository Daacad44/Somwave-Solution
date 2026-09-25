import { randomUUID } from 'node:crypto';
import { UPLOAD_MAX_BYTES } from '@somwave/shared';
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

export async function putObject(bytes: Buffer, mimeType: string): Promise<string> {
  const key = `obj/${randomUUID()}`;
  if (env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY) {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: env.S3_REGION ?? 'us-east-1',
      endpoint: env.S3_ENDPOINT,
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
      }),
    );
    return key;
  }
  if (env.NODE_ENV === 'production') {
    throw new AppError('INTERNAL_ERROR', 503, 'Kaynta faylalka lama diyaarin');
  }
  memory.set(key, bytes);
  return key;
}

export function getObject(key: string): Buffer | null {
  return memory.get(key) ?? null;
}
