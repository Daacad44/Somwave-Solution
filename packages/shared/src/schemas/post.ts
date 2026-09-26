import { z } from 'zod';

const COVER_IMAGE_MESSAGE =
  'Fadlan geli link toos ah oo sawir ah (jpg, png, webp). Linkiga raadinta Google lama aqbalo.';

const IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

/** A file or storage URL, not a search-results page such as google.com/imgres. */
export function isDirectCoverImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  const path = decodeURIComponent(url.pathname).toLowerCase();
  if (path.includes('/imgres') || path === '/search' || path.startsWith('/search/')) return false;
  const googleSearch =
    (host === 'google.com' || host.endsWith('.google.com')) &&
    !host.endsWith('.googleusercontent.com');
  if (googleSearch) return false;
  if ((host === 'bing.com' || host.endsWith('.bing.com')) && path.includes('/images')) {
    return false;
  }
  if (IMAGE_EXTENSION.test(path)) return true;
  if (host.endsWith('.googleusercontent.com')) return true;
  if (path.includes('/media/') || path.includes('/uploads/')) return true;
  return false;
}

const coverImageInput = z
  .string()
  .trim()
  .refine((value) => value === '' || isDirectCoverImageUrl(value), COVER_IMAGE_MESSAGE);

export const publicCategorySchema = z.object({
  slug: z.string(),
  name: z.string(),
});

export type PublicCategory = z.infer<typeof publicCategorySchema>;

// Summary shape for GET /api/v1/public/posts (list, paginated §10).
export const publicPostSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  coverImage: z.string().nullable(),
  authorName: z.string().nullable(),
  publishedAt: z.string().nullable(), // ISO 8601
  category: publicCategorySchema.nullable(),
});

export type PublicPostSummary = z.infer<typeof publicPostSummarySchema>;

// Detail shape for GET /api/v1/public/posts/:slug — adds the body.
export const publicPostDetailSchema = publicPostSummarySchema.extend({
  body: z.string(),
});

export type PublicPostDetail = z.infer<typeof publicPostDetailSchema>;

// A category as shown in the CMS category picker.
export const adminCategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});

export type AdminCategory = z.infer<typeof adminCategorySchema>;

// Full post shape shown in the CMS (W4) — includes body and unpublished posts.
export const adminPostSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  body: z.string(),
  coverImage: z.string().nullable(),
  authorName: z.string().nullable(),
  isPublished: z.boolean(),
  publishedAt: z.string().nullable(), // ISO 8601
  categoryId: z.string().nullable(),
  category: publicCategorySchema.nullable(),
  createdAt: z.string(),
});

export type AdminPost = z.infer<typeof adminPostSchema>;

// Create payload — used by the CMS (W4).
export const createPostSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug waa waajib')
    .regex(/^[a-z0-9-]+$/, 'Slug waa inuu noqdaa kebab-case (a-z, 0-9, -)'),
  title: z.string().trim().min(1, 'Cinwaanka waa waajib').max(200),
  excerpt: z.string().trim().min(1, 'Kooban waa waajib').max(500),
  body: z.string().trim().min(1, 'Qoraalka waa waajib'),
  coverImage: coverImageInput.optional(),
  // Blank is allowed — the CMS treats it as “no author”.
  authorName: z.string().trim().max(120, 'Magaca qoraaga aad buu u dheer yahay').optional(),
  categoryId: z.string().optional(),
  isPublished: z.boolean().default(false),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// Update payload — every field optional; at least one required.
export const updatePostSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'Slug waa inuu noqdaa kebab-case (a-z, 0-9, -)')
      .optional(),
    title: z.string().trim().min(1).max(200).optional(),
    excerpt: z.string().trim().min(1).max(500).optional(),
    body: z.string().trim().min(1).optional(),
    coverImage: coverImageInput.nullable().optional(),
    authorName: z
      .string()
      .trim()
      .max(120, 'Magaca qoraaga aad buu u dheer yahay')
      .nullable()
      .optional(),
    categoryId: z.string().nullable().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdatePostInput = z.infer<typeof updatePostSchema>;
