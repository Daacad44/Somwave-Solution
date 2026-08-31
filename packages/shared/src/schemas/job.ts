import { z } from 'zod';

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'] as const;
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);
export type EmploymentType = z.infer<typeof employmentTypeSchema>;

// Somali labels for display (§15).
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Waqti buuxa',
  PART_TIME: 'Waqti qayb ah',
  CONTRACT: 'Qandaraas',
  INTERNSHIP: 'Tababar',
};

// Summary shape for GET /api/v1/public/careers (list).
export const publicJobOpeningSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  location: z.string(),
  employmentType: employmentTypeSchema,
  summary: z.string(),
});

export type PublicJobOpeningSummary = z.infer<typeof publicJobOpeningSummarySchema>;

// Detail shape for GET /api/v1/public/careers/:slug — adds the description.
export const publicJobOpeningDetailSchema = publicJobOpeningSummarySchema.extend({
  description: z.string(),
});

export type PublicJobOpeningDetail = z.infer<typeof publicJobOpeningDetailSchema>;

// Application submitted from the website (§11). Somali validation messages (§15).
export const createJobApplicationSchema = z.object({
  name: z.string().trim().min(1, 'Magaca waa waajib').max(120),
  email: z.string().trim().email('Fadlan geli iimayl sax ah'),
  phone: z.string().trim().max(40).optional(),
  coverLetter: z.string().trim().max(5000).optional(),
  resumeUrl: z.string().url('Fadlan geli link sax ah').optional(),
});

export type CreateJobApplicationInput = z.infer<typeof createJobApplicationSchema>;

// ── CMS (W4.4) — the admin view manages openings incl. unpublished ─────────────

export const adminJobOpeningSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  location: z.string(),
  employmentType: employmentTypeSchema,
  summary: z.string(),
  description: z.string(),
  isPublished: z.boolean(),
  publishedAt: z.string().nullable(), // ISO 8601
  applicationCount: z.number().int(),
  createdAt: z.string(),
});

export type AdminJobOpening = z.infer<typeof adminJobOpeningSchema>;

export const createJobOpeningSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug waa waajib')
    .regex(/^[a-z0-9-]+$/, 'Slug waa inuu noqdaa kebab-case (a-z, 0-9, -)'),
  title: z.string().trim().min(1, 'Cinwaanka waa waajib').max(200),
  location: z.string().trim().min(1, 'Goobta waa waajib').max(200),
  employmentType: employmentTypeSchema,
  summary: z.string().trim().min(1, 'Kooban waa waajib').max(500),
  description: z.string().trim().min(1, 'Faahfaahin waa waajib'),
  isPublished: z.boolean().default(true),
});

export type CreateJobOpeningInput = z.infer<typeof createJobOpeningSchema>;

export const updateJobOpeningSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'Slug waa inuu noqdaa kebab-case (a-z, 0-9, -)')
      .optional(),
    title: z.string().trim().min(1).max(200).optional(),
    location: z.string().trim().min(1).max(200).optional(),
    employmentType: employmentTypeSchema.optional(),
    summary: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().min(1).optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateJobOpeningInput = z.infer<typeof updateJobOpeningSchema>;
