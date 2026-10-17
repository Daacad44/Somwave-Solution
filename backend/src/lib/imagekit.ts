// ImageKit adapter — the single place the ImageKit SDK is used. Every image the
// UI uploads goes through here via lib/storage.ts. The private key never leaves
// the API process; browsers only ever see delivery URLs.
import ImageKit, { APIConnectionTimeoutError, APIError, toFile } from '@imagekit/nodejs';
import type { PublicImageModule } from '@somwave/shared';
import { env } from './env';
import { logger } from './logger';
import { correlationId } from './requestContext';
import { AppError } from './http';

/** Server-chosen folders. User input never becomes part of an ImageKit path. */
export const IMAGE_FOLDERS: Record<PublicImageModule | PrivateImageModule, string> = {
  articles: 'somwave/website/articles',
  portfolio: 'somwave/website/portfolio',
  services: 'somwave/website/services',
  testimonials: 'somwave/website/testimonials',
  team: 'somwave/website/team',
  careers: 'somwave/website/careers',
  hero: 'somwave/website/hero',
  branding: 'somwave/branding/logos',
  media: 'somwave/private/media',
  documents: 'somwave/private/documents',
  'project-attachments': 'somwave/private/projects/attachments',
  'project-documentation': 'somwave/private/projects/documentation',
  inquiries: 'somwave/private/inquiries',
};

/** Modules whose images are private (signed delivery through authorised routes). */
export type PrivateImageModule =
  'media' | 'documents' | 'project-attachments' | 'project-documentation' | 'inquiries';

export type ImageModule = PublicImageModule | PrivateImageModule;

export function isPrivateModule(module: ImageModule): boolean {
  return IMAGE_FOLDERS[module].startsWith('somwave/private/');
}

export interface StoredImage {
  fileId: string;
  /** Path inside the ImageKit media library, without a leading slash. */
  filePath: string;
  url: string;
  width: number | null;
  height: number | null;
  size: number;
}

export function imageKitConfigured(): boolean {
  return Boolean(env.IMAGEKIT_PRIVATE_KEY && env.IMAGEKIT_URL_ENDPOINT);
}

export function imageKitEndpointHost(): string | null {
  return imageKitConfigured() ? new URL(urlEndpoint()).host : null;
}

function urlEndpoint(): string {
  return (env.IMAGEKIT_URL_ENDPOINT ?? '').replace(/\/+$/, '');
}

let client: ImageKit | null = null;

function imageKit(): ImageKit {
  if (!imageKitConfigured()) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      503,
      'Image storage is not configured. Ask an administrator to set the ImageKit keys on the API service.',
      { reason: 'IMAGEKIT_NOT_CONFIGURED' },
    );
  }
  // Two retries cover transient failures; uploads are idempotent per path.
  client ??= new ImageKit({
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
    timeout: 30_000,
    maxRetries: 2,
  });
  return client;
}

const FILE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** ImageKit failures become safe, actionable messages; details stay in the log. */
function translate(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof APIConnectionTimeoutError) {
    return new AppError('SERVICE_UNAVAILABLE', 503, 'Image storage did not respond. Try again.', {
      reason: 'IMAGEKIT_TIMEOUT',
    });
  }
  if (error instanceof APIError) {
    if (error.status === 401 || error.status === 403) {
      return new AppError(
        'SERVICE_UNAVAILABLE',
        503,
        'Image storage rejected the API credentials. Ask an administrator to check the ImageKit keys.',
        { reason: 'IMAGEKIT_AUTH_FAILED' },
      );
    }
    if (error.status === 400 || error.status === 422) {
      return new AppError('VALIDATION_ERROR', 400, 'The image could not be processed.', {
        reason: 'IMAGEKIT_REJECTED_FILE',
      });
    }
    if (error.status === 429) {
      return new AppError('SERVICE_UNAVAILABLE', 503, 'Image storage is busy. Try again shortly.', {
        reason: 'IMAGEKIT_RATE_LIMITED',
      });
    }
  }
  return new AppError('SERVICE_UNAVAILABLE', 503, 'Image storage is unavailable. Try again.', {
    reason: 'IMAGEKIT_UNAVAILABLE',
  });
}

async function logged<T>(
  operation: 'upload' | 'delete' | 'retrieve' | 'verify',
  module: string,
  run: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await run();
    logger.info(
      {
        provider: 'imagekit',
        module,
        operation,
        requestId: correlationId(),
        durationMs: Date.now() - started,
      },
      `[ImageKit] ${operation} ok`,
    );
    return result;
  } catch (error) {
    const safe = translate(error);
    logger.error(
      {
        provider: 'imagekit',
        module,
        operation,
        requestId: correlationId(),
        status: error instanceof APIError ? (error.status ?? null) : null,
        errorCode: (safe.details as { reason?: string } | undefined)?.reason ?? safe.code,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        durationMs: Date.now() - started,
      },
      `[ImageKit] ${operation} FAILED`,
    );
    throw safe;
  }
}

/**
 * Uploads to a server-chosen folder under a server-generated name. The path is
 * deterministic, so an SDK retry overwrites the same file instead of duplicating it.
 */
export async function uploadToImageKit(input: {
  bytes: Buffer;
  mimeType: string;
  module: ImageModule;
  name: string;
}): Promise<StoredImage> {
  if (!/^[a-z0-9]{8,64}\.(jpg|png|webp|gif)$/.test(input.name)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid image name');
  }
  const sdk = imageKit();
  const isPrivate = isPrivateModule(input.module);
  return logged('upload', input.module, async () => {
    const response = await sdk.files.upload({
      file: await toFile(input.bytes, input.name, { type: input.mimeType }),
      fileName: input.name,
      folder: `/${IMAGE_FOLDERS[input.module]}`,
      useUniqueFileName: false,
      isPrivateFile: isPrivate,
      tags: [`module-${input.module}`],
    });
    const filePath = response.filePath?.replace(/^\/+/, '');
    if (!response.fileId || !FILE_ID.test(response.fileId) || !filePath || !response.url) {
      throw new Error('ImageKit upload response is missing file metadata');
    }
    return {
      fileId: response.fileId,
      filePath,
      url: isPrivate ? '' : response.url,
      width: response.width ?? null,
      height: response.height ?? null,
      size: response.size ?? input.bytes.length,
    };
  });
}

export async function deleteFromImageKit(fileId: string, module = 'unknown'): Promise<void> {
  if (!FILE_ID.test(fileId)) return;
  const sdk = imageKit();
  await logged('delete', module, async () => {
    try {
      await sdk.files.delete(fileId);
    } catch (error) {
      // Already gone is the outcome we wanted.
      if (error instanceof APIError && error.status === 404) return;
      throw error;
    }
  });
}

/** Short-lived signed URL. Private files are only reachable this way. */
export function signedImageUrl(filePath: string, expiresInSeconds = 120): string {
  return imageKit().helper.buildSrc({
    urlEndpoint: urlEndpoint(),
    src: `/${filePath}`,
    signed: true,
    expiresIn: expiresInSeconds,
  });
}

/** Reads bytes server-side so existing authorised download routes keep working. */
export async function readFromImageKit(
  filePath: string,
  module = 'unknown',
): Promise<Buffer | null> {
  return logged('retrieve', module, async () => {
    const response = await fetch(signedImageUrl(filePath), {
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`ImageKit delivery returned ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  });
}

/** Configuration and credential check. Lists one entry; never uploads a file. */
export async function verifyImageKit(): Promise<{
  configured: boolean;
  reachable: boolean | null;
  urlEndpointHost: string | null;
  error?: string;
}> {
  const host = imageKitEndpointHost();
  if (!host) return { configured: false, reachable: null, urlEndpointHost: null };
  try {
    await logged('verify', 'storage-status', () => imageKit().assets.list({ limit: 1 }));
    return { configured: true, reachable: true, urlEndpointHost: host };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      urlEndpointHost: host,
      error: error instanceof AppError ? error.message : 'Image storage is unavailable.',
    };
  }
}

/** Test hook: drop the cached SDK client after env changes. */
export function resetImageKitClient(): void {
  client = null;
}
