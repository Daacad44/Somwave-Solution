import { z } from 'zod';

// Projects (I2.1). Projects originate in Internal; the Portal reads them (Gate 1).
// Shared by the internal admin UI resolver and the backend validate() (§11, §16).

export const PROJECT_STATUSES = [
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

// Somali labels for display (§15).
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Qorshaynta',
  ACTIVE: 'Socda',
  ON_HOLD: 'La joojiyay',
  COMPLETED: 'La dhammeeyay',
  CANCELLED: 'La baabi’iyay',
};

// Money is transmitted as a decimal string (§7 — stored Decimal(12,2), never Float).
const moneyString = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Fadlan geli qiime sax ah')
  .optional();

// A project as shown in the internal admin list/detail.
export const adminProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  startDate: z.string().nullable(), // ISO 8601
  dueDate: z.string().nullable(),
  budget: z.string().nullable(), // decimal string
  clientId: z.string().nullable(),
  manager: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
});

export type AdminProject = z.infer<typeof adminProjectSchema>;

// Dates arrive from the form as ISO date strings (the shared picker, §11).
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Taariikh aan sax ahayn')
  .optional();

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Magaca waa waajib').max(200),
  description: z.string().trim().max(5000).optional(),
  status: projectStatusSchema.default('PLANNING'),
  startDate: isoDate,
  dueDate: isoDate,
  budget: moneyString,
  clientId: z.string().optional(),
  managerId: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1, 'Magaca waa waajib').max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: projectStatusSchema.optional(),
    startDate: isoDate.nullable(),
    dueDate: isoDate.nullable(),
    budget: moneyString.nullable(),
    clientId: z.string().nullable().optional(),
    managerId: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
