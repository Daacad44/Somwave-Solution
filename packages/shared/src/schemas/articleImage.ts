import { z } from 'zod';

/** Article covers are smaller than the general 25MB upload cap. */
export const ARTICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const ARTICLE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ArticleImageMimeType = (typeof ARTICLE_IMAGE_MIME_TYPES)[number];

const ARTICLE_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

const INVALID_IMAGE = 'Fadlan soo geli sawir JPG, PNG ama WEBP ah.';
const TOO_LARGE = 'Sawirku waa inuu ka yaraadaa 5MB.';

const ARTICLE_IMAGE_PATH = /^\/api\/v1\/public\/article-images\/([a-z0-9]+)$/i;

/** URL returned by the article image upload, not a pasted external link. */
export function articleImageIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const match = url.pathname.match(ARTICLE_IMAGE_PATH);
    return match?.[1] ?? null;
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
  if (file.size <= 0) return 'Fadlan soo geli sawir sax ah.';
  if (file.size > ARTICLE_IMAGE_MAX_BYTES) return TOO_LARGE;
  return null;
}

export const uploadArticleImageSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
  contentBase64: z.string().min(1, 'Fadlan soo geli sawir sax ah.').max(7_000_000, TOO_LARGE),
});

export type UploadArticleImageInput = z.infer<typeof uploadArticleImageSchema>;

export const uploadedArticleImageSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
  size: z.number().int().nonnegative(),
  mimeType: z.enum(ARTICLE_IMAGE_MIME_TYPES),
});

export type UploadedArticleImage = z.infer<typeof uploadedArticleImageSchema>;
