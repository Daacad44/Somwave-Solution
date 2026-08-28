import { z } from 'zod';

// Tasks (I2.2). A task belongs to a project (the owner key, §7). Shared by the
// internal admin UI resolver and the backend validate() (§11, §16).

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'La qorsheeyay',
  IN_PROGRESS: 'Socda',
  IN_REVIEW: 'Dib-u-eegis',
  DONE: 'La dhammeeyay',
};

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Hoose',
  MEDIUM: 'Dhexe',
  HIGH: 'Sare',
  URGENT: 'Degdeg',
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
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Taariikh aan sax ahayn')
  .optional();

export const createTaskSchema = z.object({
  projectId: z.string().min(1, 'Mashruuca waa waajib'),
  title: z.string().trim().min(1, 'Cinwaanka waa waajib').max(200),
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
    title: z.string().trim().min(1, 'Cinwaanka waa waajib').max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: z.string().nullable().optional(),
    dueDate: isoDate.nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
