import { z } from 'zod';

export const TIMESHEET_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const timesheetStatusSchema = z.enum(TIMESHEET_STATUSES);
export type TimesheetStatus = z.infer<typeof timesheetStatusSchema>;

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  PENDING: 'Sugaya',
  APPROVED: 'La ansixiyay',
  REJECTED: 'La diiday',
};

const hoursString = z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, 'Fadlan geli saacado sax ah');

export const adminTimesheetSchema = z.object({
  id: z.string(),
  date: z.string(),
  hours: z.string(),
  isBillable: z.boolean(),
  note: z.string().nullable(),
  status: timesheetStatusSchema,
  project: z.object({ id: z.string(), name: z.string() }).nullable(),
  employee: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.string(),
});

export type AdminTimesheet = z.infer<typeof adminTimesheetSchema>;

export const createTimesheetSchema = z.object({
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Taariikh aan sax ahayn'),
  hours: hoursString,
  projectId: z.string().optional(),
  isBillable: z.boolean().default(true),
  note: z.string().trim().max(2000).optional(),
});

export type CreateTimesheetInput = z.infer<typeof createTimesheetSchema>;

export const updateTimesheetSchema = z.object({
  status: timesheetStatusSchema,
});

export type UpdateTimesheetInput = z.infer<typeof updateTimesheetSchema>;
