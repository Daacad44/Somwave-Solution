import { z } from 'zod';

// Testimonials (W5.1). Social proof shown on the public website; managed from the
// CMS (content.*). Shared by the public API, the CMS UI, and validate() (§11, §16).

// Summary shape for GET /api/v1/public/testimonials.
export const publicTestimonialSchema = z.object({
  id: z.string(),
  author: z.string(),
  role: z.string().nullable(),
  company: z.string().nullable(),
  quote: z.string(),
  avatarUrl: z.string().nullable(),
  rating: z.number().int().nullable(),
});

export type PublicTestimonial = z.infer<typeof publicTestimonialSchema>;

// Full shape shown in the CMS — includes unpublished items and order.
export const adminTestimonialSchema = publicTestimonialSchema.extend({
  order: z.number().int(),
  isPublished: z.boolean(),
  createdAt: z.string(), // ISO 8601
});

export type AdminTestimonial = z.infer<typeof adminTestimonialSchema>;

export const createTestimonialSchema = z.object({
  author: z.string().trim().min(1, 'Qoraaga waa waajib').max(200),
  role: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  quote: z.string().trim().min(1, 'Marag-furka waa waajib').max(2000),
  avatarUrl: z.string().url('Fadlan geli link sax ah').optional(),
  rating: z.number().int().min(1).max(5).optional(),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(true),
});

export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;

export const updateTestimonialSchema = z
  .object({
    author: z.string().trim().min(1).max(200).optional(),
    role: z.string().trim().max(200).nullable().optional(),
    company: z.string().trim().max(200).nullable().optional(),
    quote: z.string().trim().min(1).max(2000).optional(),
    avatarUrl: z.string().url('Fadlan geli link sax ah').nullable().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    order: z.number().int().nonnegative().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>;
