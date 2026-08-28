import { z } from 'zod';

// Milestones (I2.3). A milestone belongs to a project (the owner key, §7). The
// Portal reads them (Gate 1: P2.3). Shared by the admin UI and validate() (§11).

export const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export const milestoneStatusSchema = z.enum(MILESTONE_STATUSES);
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  PENDING: 'La sugayo',
  IN_PROGRESS: 'Socda',
  COMPLETED: 'La gaaray',
};

export const adminMilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: milestoneStatusSchema,
  dueDate: z.string().nullable(), // ISO 8601
  completedAt: z.string().nullable(),
  order: z.number().int(),
  project: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.string(),
});

export type AdminMilestone = z.infer<typeof adminMilestoneSchema>;

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Taariikh aan sax ahayn')
  .optional();

export const createMilestoneSchema = z.object({
  projectId: z.string().min(1, 'Mashruuca waa waajib'),
  title: z.string().trim().min(1, 'Cinwaanka waa waajib').max(200),
  description: z.string().trim().max(5000).optional(),
  status: milestoneStatusSchema.default('PENDING'),
  dueDate: isoDate,
  order: z.number().int().min(0).default(0),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

// The project a milestone belongs to is fixed once created; everything else editable.
export const updateMilestoneSchema = z
  .object({
    title: z.string().trim().min(1, 'Cinwaanka waa waajib').max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: milestoneStatusSchema.optional(),
    dueDate: isoDate.nullable(),
    order: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
