import { z } from 'zod';

// Summary shape for GET /api/v1/public/portfolio (list). §10.
export const publicPortfolioItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  client: z.string().nullable(),
  coverImage: z.string().nullable(),
  order: z.number().int(),
});

export type PublicPortfolioItem = z.infer<typeof publicPortfolioItemSchema>;

// Detail shape for GET /api/v1/public/portfolio/:slug — adds the body.
export const publicPortfolioDetailSchema = publicPortfolioItemSchema.extend({
  description: z.string().nullable(),
});

export type PublicPortfolioDetail = z.infer<typeof publicPortfolioDetailSchema>;

// Full shape shown in the CMS (W4.3) — includes unpublished items and dates.
export const adminPortfolioItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  description: z.string().nullable(),
  client: z.string().nullable(),
  coverImage: z.string().nullable(),
  order: z.number().int(),
  isPublished: z.boolean(),
  publishedAt: z.string().nullable(), // ISO 8601
  createdAt: z.string(),
});

export type AdminPortfolioItem = z.infer<typeof adminPortfolioItemSchema>;

// Create payload — used by the CMS (W4.3).
export const createPortfolioItemSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug waa waajib')
    .regex(/^[a-z0-9-]+$/, 'Slug waa inuu noqdaa kebab-case (a-z, 0-9, -)'),
  title: z.string().trim().min(1, 'Cinwaanka waa waajib').max(200),
  summary: z.string().trim().min(1, 'Kooban waa waajib').max(500),
  description: z.string().trim().max(5000).optional(),
  client: z.string().trim().max(200).optional(),
  coverImage: z.string().url('Fadlan geli link sax ah').optional(),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(true),
});

export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;

// Update payload — every field optional; at least one required.
export const updatePortfolioItemSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'Slug waa inuu noqdaa kebab-case (a-z, 0-9, -)')
      .optional(),
    title: z.string().trim().min(1).max(200).optional(),
    summary: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    client: z.string().trim().max(200).nullable().optional(),
    coverImage: z.string().url('Fadlan geli link sax ah').nullable().optional(),
    order: z.number().int().nonnegative().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdatePortfolioItemInput = z.infer<typeof updatePortfolioItemSchema>;
