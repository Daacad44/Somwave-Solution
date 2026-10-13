import { z } from 'zod';

// Project membership is separate from organization-wide roles. A member's
// project role controls access to private engineering resources.
export const PROJECT_MEMBER_ROLES = [
  'MANAGER',
  'LEAD_ENGINEER',
  'ENGINEER',
  'REVIEWER',
  'QA_ENGINEER',
  'CONTRIBUTOR',
  'VIEWER',
] as const;
export const projectMemberRoleSchema = z.enum(PROJECT_MEMBER_ROLES);
export type ProjectMemberRole = z.infer<typeof projectMemberRoleSchema>;

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1),
  role: projectMemberRoleSchema.default('ENGINEER'),
  responsibilities: z.string().trim().max(2000).nullable().optional(),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const inviteProjectEngineerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(255)
      .transform((value) => value.toLowerCase()),
    name: z.string().trim().min(1).max(120).optional(),
    role: z
      .enum(['ENGINEER', 'LEAD_ENGINEER', 'REVIEWER', 'QA_ENGINEER', 'CONTRIBUTOR'])
      .default('ENGINEER'),
    description: z.string().trim().min(1).max(2000),
    responsibilities: z.string().trim().max(2000).nullable().optional(),
    startDate: z.string().datetime({ offset: true }),
    expectedEndDate: z.string().datetime({ offset: true }),
    estimatedHours: z.number().positive().max(10000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    managerNotes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((input) => new Date(input.expectedEndDate) >= new Date(input.startDate), {
    path: ['expectedEndDate'],
    message: 'Expected end date must follow start date',
  });
export type InviteProjectEngineerInput = z.infer<typeof inviteProjectEngineerSchema>;

export const respondProjectInvitationSchema = z.object({
  decision: z.enum(['ACCEPT', 'DECLINE']),
});
export type RespondProjectInvitationInput = z.infer<typeof respondProjectInvitationSchema>;

export const reassignProjectTasksSchema = z
  .object({
    fromUserId: z.string().min(1),
    toUserId: z.string().min(1),
  })
  .refine((value) => value.fromUserId !== value.toUserId, {
    path: ['toUserId'],
    message: 'Choose a different engineer',
  });
export type ReassignProjectTasksInput = z.infer<typeof reassignProjectTasksSchema>;

export const createProjectHandoverSchema = z
  .object({
    fromUserId: z.string().min(1),
    toUserId: z.string().min(1),
    removeSource: z.boolean().default(false),
    transferBugs: z.boolean().default(false),
    transferMaintenance: z.boolean().default(false),
    transferDocuments: z.boolean().default(false),
    transferReleases: z.boolean().default(false),
    notes: z.string().trim().min(1).max(5000),
  })
  .refine((input) => input.fromUserId !== input.toUserId, {
    path: ['toUserId'],
    message: 'Choose a different engineer',
  });
export type CreateProjectHandoverInput = z.infer<typeof createProjectHandoverSchema>;

export const updateProjectMemberSchema = z
  .object({
    role: projectMemberRoleSchema.optional(),
    responsibilities: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'At least one change is required');
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>;

export const ENGINEERING_TASK_TYPES = [
  'FEATURE',
  'BUG_FIX',
  'IMPROVEMENT',
  'RESEARCH',
  'DESIGN',
  'TESTING',
  'DOCUMENTATION',
  'MAINTENANCE',
  'OTHER',
] as const;
export const engineeringTaskTypeSchema = z.enum(ENGINEERING_TASK_TYPES);

export const ENGINEERING_TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const engineeringTaskPrioritySchema = z.enum(ENGINEERING_TASK_PRIORITIES);

export const createEngineeringTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional(),
    type: engineeringTaskTypeSchema.default('FEATURE'),
    priority: engineeringTaskPrioritySchema.default('MEDIUM'),
    estimatedHours: z.coerce.number().positive().max(10000).optional(),
    acceptanceCriteria: z.string().trim().max(10000).optional(),
    assigneeId: z.string().min(1).optional(),
    milestoneId: z.string().min(1).optional(),
    parentTaskId: z.string().min(1).optional(),
    kind: z.enum(['EPIC', 'TASK', 'SUBTASK']).optional(),
    phaseId: z.string().min(1).optional(),
    startDate: z.string().datetime({ offset: true }).optional(),
    dependencyIds: z.array(z.string().min(1)).max(50).optional(),
    checklist: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
    dueDate: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.kind === 'SUBTASK' && !input.parentTaskId)
      ctx.addIssue({
        code: 'custom',
        path: ['parentTaskId'],
        message: 'A subtask requires a parent task',
      });
    if (input.startDate && input.dueDate && new Date(input.startDate) > new Date(input.dueDate))
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Due date must follow start date',
      });
  });
export type CreateEngineeringTaskInput = z.infer<typeof createEngineeringTaskSchema>;

export const createProjectPhaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  order: z.number().int().min(0).optional(),
});
export type CreateProjectPhaseInput = z.infer<typeof createProjectPhaseSchema>;

export const createTaskCommentSchema = z.object({ body: z.string().trim().min(1).max(10000) });
export const createTaskProgressSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  progressPercent: z.number().int().min(0).max(100),
  blockedReason: z.string().trim().max(2000).nullable().optional(),
});
export const createTaskChecklistItemSchema = z.object({ title: z.string().trim().min(1).max(500) });
export const updateTaskChecklistItemSchema = z.object({ completed: z.boolean() });
export const createTaskDependencySchema = z.object({ dependsOnId: z.string().min(1) });
export const scheduleEngineeringTaskSchema = z
  .object({
    startDate: z.string().datetime({ offset: true }).nullable(),
    dueDate: z.string().datetime({ offset: true }).nullable(),
    phaseId: z.string().min(1).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.startDate && input.dueDate && new Date(input.startDate) > new Date(input.dueDate))
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Due date must follow start date',
      });
  });

export const taskTimeEntrySchema = z.object({
  minutes: z.number().int().min(1).max(1440),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(2000).optional(),
});

export const taskAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  contentBase64: z.string().min(1).max(35_000_000),
});

export const updateEngineerProfileSchema = z.object({
  headline: z.string().trim().max(500).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  availability: z.enum(['AVAILABLE', 'LIMITED', 'UNAVAILABLE']).optional(),
  weeklyCapacityHours: z.number().min(1).max(80).optional(),
  timezone: z
    .string()
    .min(1)
    .max(80)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid timezone')
    .optional(),
});
export type UpdateEngineerProfileInput = z.infer<typeof updateEngineerProfileSchema>;

export const createEngineerAvailabilitySchema = z
  .object({
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    kind: z.enum(['WORKING', 'TIME_OFF', 'ON_CALL']),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((value) => new Date(value.endAt) > new Date(value.startAt), {
    path: ['endAt'],
    message: 'End time must follow start time',
  });
export type CreateEngineerAvailabilityInput = z.infer<typeof createEngineerAvailabilitySchema>;

export const reviewEngineeringTaskSchema = z
  .object({
    decision: z.enum(['START_REVIEW', 'APPROVE', 'REQUEST_CHANGES', 'REJECT']),
    note: z.string().trim().max(5000).optional(),
  })
  .superRefine((input, ctx) => {
    if ((input.decision === 'REQUEST_CHANGES' || input.decision === 'REJECT') && !input.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'A reason is required',
      });
    }
  });
export type ReviewEngineeringTaskInput = z.infer<typeof reviewEngineeringTaskSchema>;
