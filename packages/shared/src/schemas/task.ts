import { z } from 'zod';

// Tasks (I2.2). A task belongs to a project (the owner key, §7). Shared by the
// internal admin UI resolver and the backend validate() (§11, §16).

export const TASK_STATUSES = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
  'TESTING',
  'DONE',
  'CANCELLED',
] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  IN_REVIEW: 'In review',
  TESTING: 'Testing',
  DONE: 'Completed',
  CANCELLED: 'Cancelled',
};

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

// A task as shown in the internal admin list/detail.
export const adminTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z.string().nullable(), // ISO 8601
  project: z.object({ id: z.string(), name: z.string() }),
  assignee: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
});

export type AdminTask = z.infer<typeof adminTaskSchema>;

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
  .optional();

export const createTaskSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional(),
  status: taskStatusSchema.default('TODO'),
  priority: taskPrioritySchema.default('MEDIUM'),
  assigneeId: z.string().optional(),
  dueDate: isoDate,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// The project a task belongs to is fixed once created; everything else is editable.
export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: z.string().nullable().optional(),
    dueDate: isoDate.nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one change is required',
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
