import { z } from 'zod';

/** Article covers are smaller than the general 25MB upload cap. */
export const ARTICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const ARTICLE_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type ArticleImageMimeType = (typeof ARTICLE_IMAGE_MIME_TYPES)[number];

const ARTICLE_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;

const INVALID_IMAGE = 'Upload a JPG, PNG, WebP, or GIF image.';

/** Website modules an uploaded public image belongs to (selects its ImageKit folder). */
export const PUBLIC_IMAGE_MODULES = [
  'articles',
  'portfolio',
  'services',
  'testimonials',
  'team',
  'careers',
  'hero',
  'branding',
] as const;

export type PublicImageModule = (typeof PUBLIC_IMAGE_MODULES)[number];
const TOO_LARGE = 'The image must be smaller than 5 MB.';

const ARTICLE_IMAGE_PATH = /^\/api\/v1\/public\/article-images\/([a-z0-9]+)$/i;

/** ImageKit delivery path: `[/<imagekit id>]/somwave/<area>/<module>/<media id>.<ext>`. */
const IMAGEKIT_IMAGE_PATH =
  /^(?:\/[A-Za-z0-9_-]+)?\/somwave\/(?:website|branding)\/[a-z-]+\/([a-z0-9]{20,40})\.(?:jpg|png|webp|gif)$/;

/**
 * Media id of a URL returned by the image upload (API route or ImageKit CDN),
 * not a pasted external link. The server still checks the id has a record.
 */
export function articleImageIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const legacy = url.pathname.match(ARTICLE_IMAGE_PATH)?.[1];
    if (legacy) return legacy;
    if (url.protocol !== 'https:' || url.search || url.hash) return null;
    return url.pathname.match(IMAGEKIT_IMAGE_PATH)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isStoredArticleImageUrl(value: string): boolean {
  return articleImageIdFromUrl(value) !== null;
}

export function articleImageExtension(fileName: string): string {
  const base = fileName.replace(/\\/g, '/').split('/').pop() ?? '';
  return base.includes('.') ? (base.split('.').pop()?.toLowerCase() ?? '') : '';
}

/** Client-side check before a file is previewed or uploaded. Null means the file is acceptable. */
export function articleImageFileError(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const extension = articleImageExtension(file.name);
  const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  const mimeOk = (ARTICLE_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
  const extensionOk = (ARTICLE_IMAGE_EXTENSIONS as readonly string[]).includes(extension);
  if (!mimeOk || !extensionOk) return INVALID_IMAGE;
  if (file.size <= 0) return 'Upload a valid image.';
  if (file.size > ARTICLE_IMAGE_MAX_BYTES) return TOO_LARGE;
  return null;
}

export const uploadArticleImageSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
  contentBase64: z.string().min(1, 'Upload a valid image.').max(7_000_000, TOO_LARGE),
  module: z.enum(PUBLIC_IMAGE_MODULES).optional(),
});

export type UploadArticleImageInput = z.infer<typeof uploadArticleImageSchema>;

export const uploadedArticleImageSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
  size: z.number().int().nonnegative(),
  mimeType: z.enum(ARTICLE_IMAGE_MIME_TYPES),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});

export type UploadedArticleImage = z.infer<typeof uploadedArticleImageSchema>;
