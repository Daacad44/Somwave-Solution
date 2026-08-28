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
