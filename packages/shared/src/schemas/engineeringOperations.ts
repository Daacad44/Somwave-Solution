import { z } from 'zod';

export const createManagedSystemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  technologyStack: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  productionUrl: z.string().url().optional(),
  stagingUrl: z.string().url().optional(),
  hostingProvider: z.string().trim().max(200).optional(),
  assignedEngineerId: z.string().min(1).optional(),
});
export type CreateManagedSystemInput = z.infer<typeof createManagedSystemSchema>;

export const createSystemUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.enum([
    'NEW_FEATURE',
    'SECURITY_PATCH',
    'BUG_FIX',
    'PERFORMANCE_OPTIMIZATION',
    'UI_UX_UPDATE',
    'DATABASE_MIGRATION',
    'DEPENDENCY_UPGRADE',
    'INFRASTRUCTURE_CHANGE',
  ]),
});
export type CreateSystemUpdateInput = z.infer<typeof createSystemUpdateSchema>;

export const createBugReportSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  environment: z.string().trim().max(120).optional(),
  reproductionSteps: z.string().trim().max(10000).optional(),
  expectedResult: z.string().trim().max(5000).optional(),
  actualResult: z.string().trim().max(5000).optional(),
});
export type CreateBugReportInput = z.infer<typeof createBugReportSchema>;

export const updateBugReportSchema = z.object({
  status: z.enum([
    'TRIAGED',
    'ASSIGNED',
    'IN_PROGRESS',
    'CODE_REVIEW',
    'TESTING',
    'RESOLVED',
    'CLOSED',
    'REOPENED',
  ]),
  rootCause: z.string().trim().max(10000).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
});
export type UpdateBugReportInput = z.infer<typeof updateBugReportSchema>;

export const createMaintenanceRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional(),
    type: z.enum([
      'PREVENTIVE',
      'CORRECTIVE',
      'EMERGENCY',
      'SCHEDULED',
      'SECURITY_PATCH',
      'HEALTH_CHECK',
      'INCIDENT',
    ]),
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    recurrenceRule: z
      .string()
      .trim()
      .regex(
        /^FREQ=(DAILY|WEEKLY|MONTHLY)(;INTERVAL=([1-9]\d{0,2}))?$/,
        'Use FREQ=DAILY, WEEKLY, or MONTHLY with an optional INTERVAL',
      )
      .optional(),
    responseDueAt: z.string().datetime({ offset: true }).optional(),
    resolutionDueAt: z.string().datetime({ offset: true }).optional(),
    assigneeId: z.string().min(1).optional(),
  })
  .refine((value) => !value.recurrenceRule || Boolean(value.scheduledAt), {
    path: ['scheduledAt'],
    message: 'Recurring maintenance requires a scheduled date',
  });
export type CreateMaintenanceRequestInput = z.infer<typeof createMaintenanceRequestSchema>;

export const updateMaintenanceRequestSchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  rootCause: z.string().trim().max(10000).optional(),
  resolutionNotes: z.string().trim().max(10000).optional(),
});
export type UpdateMaintenanceRequestInput = z.infer<typeof updateMaintenanceRequestSchema>;

export const transitionSystemUpdateSchema = z.object({
  status: z.enum([
    'APPROVED',
    'ASSIGNED',
    'IN_DEVELOPMENT',
    'CODE_REVIEW',
    'TESTING',
    'STAGING',
    'PRODUCTION_APPROVAL',
    'DEPLOYED',
    'VERIFIED',
    'COMPLETED',
    'CANCELLED',
  ]),
});
export type TransitionSystemUpdateInput = z.infer<typeof transitionSystemUpdateSchema>;

export const createReleaseSchema = z.object({
  version: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(10000).optional(),
  rollbackPlan: z.string().trim().min(1).max(10000),
});
export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;

export const transitionReleaseSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'PENDING_APPROVAL', 'VERIFIED', 'ROLLED_BACK', 'CANCELLED']),
});
export type TransitionReleaseInput = z.infer<typeof transitionReleaseSchema>;

export const recordDeploymentSchema = z.object({
  environment: z.enum(['STAGING', 'PRODUCTION']),
  status: z.enum(['SUCCEEDED', 'FAILED', 'ROLLED_BACK']),
  notes: z.string().trim().max(10000).optional(),
});
export type RecordDeploymentInput = z.infer<typeof recordDeploymentSchema>;
