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

// Create/update payload — used by the CMS / Internal admin in a later phase.
export const createServiceSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case (a-z, 0-9, -)'),
  title: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(true),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
