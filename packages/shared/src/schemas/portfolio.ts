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

// Create/update payload — used by the CMS later.
export const createPortfolioItemSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case (a-z, 0-9, -)'),
  title: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().optional(),
  client: z.string().optional(),
  coverImage: z.string().url().optional(),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(true),
});

export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;
