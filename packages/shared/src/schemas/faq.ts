import { z } from 'zod';

// FAQ (W5.3). Frequently-asked questions shown on the public website; managed
// from the CMS (content.*). Shared by the public API, the CMS UI, and validate().

export const publicFaqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
});

export type PublicFaq = z.infer<typeof publicFaqSchema>;

export const adminFaqSchema = publicFaqSchema.extend({
  order: z.number().int(),
  isPublished: z.boolean(),
  createdAt: z.string(), // ISO 8601
});

export type AdminFaq = z.infer<typeof adminFaqSchema>;

export const createFaqSchema = z.object({
  question: z.string().trim().min(1, 'Su’aasha waa waajib').max(300),
  answer: z.string().trim().min(1, 'Jawaabta waa waajib').max(3000),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(true),
});

export type CreateFaqInput = z.infer<typeof createFaqSchema>;

export const updateFaqSchema = z
  .object({
    question: z.string().trim().min(1).max(300).optional(),
    answer: z.string().trim().min(1).max(3000).optional(),
    order: z.number().int().nonnegative().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
