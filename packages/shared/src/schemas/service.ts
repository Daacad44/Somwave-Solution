import { z } from 'zod';

// Public shape returned by GET /api/v1/public/services (SYSTEM_PROMPT §10).
export const publicServiceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  order: z.number().int(),
});

export type PublicService = z.infer<typeof publicServiceSchema>;

export const publicServiceDetailSchema = publicServiceSchema.extend({
  description: z.string().nullable(),
});

export type PublicServiceDetail = z.infer<typeof publicServiceDetailSchema>;

// Full shape shown in the CMS (W4) — includes unpublished fields (§9).
export const adminServiceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  order: z.number().int(),
  isPublished: z.boolean(),
  createdAt: z.string(), // ISO 8601
});

export type AdminService = z.infer<typeof adminServiceSchema>;

// Create payload — used by the CMS (W4).
export const createServiceSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must use kebab-case (a-z, 0-9, -)'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  summary: z.string().trim().min(1, 'Summary is required').max(500),
  description: z.string().trim().max(5000).optional(),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(true),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

// Update payload — every field optional; at least one required.
export const updateServiceSchema = z
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
    order: z.number().int().nonnegative().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one change is required',
  });

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
