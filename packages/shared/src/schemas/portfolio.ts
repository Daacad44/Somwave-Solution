import { z } from 'zod';

export const portfolioCategorySchema = z.enum(['WEBSITE', 'MOBILE_APP', 'CUSTOM_SOFTWARE']);
export type PortfolioCategory = z.infer<typeof portfolioCategorySchema>;

const portfolioUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || protocol === 'http:';
  }, 'Enter an HTTP or HTTPS URL');
const shortListSchema = z.array(z.string().trim().min(1).max(200)).max(30);

// Summary shape for GET /api/v1/public/portfolio (list). §10.
export const publicPortfolioItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  client: z.string().nullable(),
  category: portfolioCategorySchema.nullable().optional(),
  coverImage: z.string().nullable(),
  order: z.number().int(),
  featured: z.boolean(),
});

export type PublicPortfolioItem = z.infer<typeof publicPortfolioItemSchema>;

// Detail shape for GET /api/v1/public/portfolio/:slug — adds the body.
export const publicPortfolioDetailSchema = publicPortfolioItemSchema.extend({
  description: z.string().nullable(),
  technologies: shortListSchema,
  galleryImages: z.array(portfolioUrlSchema).max(20),
  features: shortListSchema,
  completionDate: z.string().nullable(),
  projectStatus: z.string().nullable(),
  liveDemoUrl: portfolioUrlSchema.nullable(),
  caseStudyUrl: portfolioUrlSchema.nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
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
  category: portfolioCategorySchema.nullable(),
  coverImage: z.string().nullable(),
  order: z.number().int(),
  technologies: shortListSchema,
  galleryImages: z.array(portfolioUrlSchema).max(20),
  features: shortListSchema,
  completionDate: z.string().nullable(),
  projectStatus: z.string().nullable(),
  liveDemoUrl: portfolioUrlSchema.nullable(),
  caseStudyUrl: portfolioUrlSchema.nullable(),
  featured: z.boolean(),
  isArchived: z.boolean(),
  demoClicks: z.number().int().nonnegative(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
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
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must use kebab-case (a-z, 0-9, -)'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  summary: z.string().trim().min(1, 'Summary is required').max(500),
  description: z.string().trim().max(5000).optional(),
  client: z.string().trim().max(200).optional(),
  category: portfolioCategorySchema.optional(),
  coverImage: z.string().url('Enter a valid URL').optional(),
  technologies: shortListSchema.optional(),
  galleryImages: z.array(portfolioUrlSchema).max(20).optional(),
  features: shortListSchema.optional(),
  completionDate: z.string().date().nullable().optional(),
  projectStatus: z.string().trim().max(100).nullable().optional(),
  liveDemoUrl: portfolioUrlSchema.nullable().optional(),
  caseStudyUrl: portfolioUrlSchema.nullable().optional(),
  featured: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(false),
});

export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;

// Update payload — every field optional; at least one required.
export const updatePortfolioItemSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'Slug must use kebab-case (a-z, 0-9, -)')
      .optional(),
    title: z.string().trim().min(1).max(200).optional(),
    summary: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    client: z.string().trim().max(200).nullable().optional(),
    category: portfolioCategorySchema.nullable().optional(),
    coverImage: z.string().url('Enter a valid URL').nullable().optional(),
    technologies: shortListSchema.optional(),
    galleryImages: z.array(portfolioUrlSchema).max(20).optional(),
    features: shortListSchema.optional(),
    completionDate: z.string().date().nullable().optional(),
    projectStatus: z.string().trim().max(100).nullable().optional(),
    liveDemoUrl: portfolioUrlSchema.nullable().optional(),
    caseStudyUrl: portfolioUrlSchema.nullable().optional(),
    featured: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    seoTitle: z.string().trim().max(200).nullable().optional(),
    seoDescription: z.string().trim().max(500).nullable().optional(),
    order: z.number().int().nonnegative().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one change is required',
  });

export type UpdatePortfolioItemInput = z.infer<typeof updatePortfolioItemSchema>;
