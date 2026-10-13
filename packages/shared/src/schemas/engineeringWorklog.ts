import { z } from 'zod';

const workDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const stopEngineerTimerSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});
export type StopEngineerTimerInput = z.infer<typeof stopEngineerTimerSchema>;

export const discardEngineerTimerSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});
export type DiscardEngineerTimerInput = z.infer<typeof discardEngineerTimerSchema>;

export const correctTaskTimeEntrySchema = z.object({
  minutes: z.number().int().min(1).max(1440),
  date: workDate,
  note: z.string().trim().max(2000).nullable().optional(),
  reason: z.string().trim().min(5).max(1000),
});
export type CorrectTaskTimeEntryInput = z.infer<typeof correctTaskTimeEntrySchema>;

export const createEngineerProgressReportSchema = z.object({
  period: z.enum(['DAILY', 'WEEKLY']),
  periodStart: workDate,
  completedWork: z.string().trim().min(1).max(10000),
  inProgressWork: z.string().trim().max(10000).optional(),
  blockers: z.string().trim().max(10000).optional(),
  nextPlannedWork: z.string().trim().max(10000).optional(),
  milestoneProgress: z.string().trim().max(10000).optional(),
  priorities: z.string().trim().max(10000).optional(),
  reportedHoursMinutes: z.number().int().min(0).max(10080).optional(),
});
export type CreateEngineerProgressReportInput = z.infer<typeof createEngineerProgressReportSchema>;

export const reviewEngineerProgressReportSchema = z.object({
  status: z.enum(['REVIEWED', 'CLARIFICATION_REQUESTED']),
  note: z.string().trim().min(3).max(5000),
});
export type ReviewEngineerProgressReportInput = z.infer<typeof reviewEngineerProgressReportSchema>;
