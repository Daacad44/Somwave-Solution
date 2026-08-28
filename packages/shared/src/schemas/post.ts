import { z } from 'zod';

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
  publishedAt: z.string().nullable(), // ISO 8601
  category: publicCategorySchema.nullable(),
});

export type PublicPostSummary = z.infer<typeof publicPostSummarySchema>;

// Detail shape for GET /api/v1/public/posts/:slug — adds the body.
export const publicPostDetailSchema = publicPostSummarySchema.extend({
  body: z.string(),
});

export type PublicPostDetail = z.infer<typeof publicPostDetailSchema>;

// Create/update payload — used by the CMS later.
export const createPostSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case (a-z, 0-9, -)'),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  body: z.string().min(1),
  coverImage: z.string().url().optional(),
  categoryId: z.string().optional(),
  isPublished: z.boolean().default(false),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
