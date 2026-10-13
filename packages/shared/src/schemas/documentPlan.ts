import { z } from 'zod';

const key = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);
const title = z.string().trim().min(1).max(200);
const description = z.string().trim().max(5000).optional();
const date = z.string().datetime({ offset: true }).optional();

const phase = z.object({ key, title, description, startDate: date, dueDate: date });
const milestone = z.object({ key, phaseKey: key, title, description, dueDate: date });
const task = z.object({
  key,
  kind: z.enum(['EPIC', 'TASK', 'SUBTASK']),
  title,
  description,
  phaseKey: key,
  milestoneKey: key,
  parentKey: key.optional(),
  type: z
    .enum([
      'FEATURE',
      'BUG_FIX',
      'IMPROVEMENT',
      'RESEARCH',
      'DESIGN',
      'TESTING',
      'DOCUMENTATION',
      'MAINTENANCE',
      'OTHER',
    ])
    .default('FEATURE'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  estimatedHours: z.number().positive().max(10_000).optional(),
  acceptanceCriteria: z.string().trim().max(10_000).optional(),
  startDate: date,
  dueDate: date,
  dependencyKeys: z.array(key).max(30).default([]),
  checklist: z.array(title).max(100).default([]),
});

export const documentPlanSchema = z
  .object({
    phases: z.array(phase).min(1).max(20),
    milestones: z.array(milestone).min(1).max(50),
    tasks: z.array(task).min(1).max(200),
  })
  .superRefine((plan, ctx) => {
    const phases = new Map(plan.phases.map((item) => [item.key, item]));
    const milestones = new Map(plan.milestones.map((item) => [item.key, item]));
    const tasks = new Map(plan.tasks.map((item) => [item.key, item]));
    const unique = (items: { key: string }[], path: string) => {
      if (new Set(items.map((item) => item.key)).size !== items.length)
        ctx.addIssue({ code: 'custom', path: [path], message: 'Keys must be unique' });
    };
    unique(plan.phases, 'phases');
    unique(plan.milestones, 'milestones');
    unique(plan.tasks, 'tasks');
    for (const [index, item] of plan.phases.entries()) {
      if (item.startDate && item.dueDate && new Date(item.startDate) > new Date(item.dueDate))
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'dueDate'],
          message: 'Due date must follow start date',
        });
    }
    for (const [index, item] of plan.milestones.entries()) {
      if (!phases.has(item.phaseKey))
        ctx.addIssue({
          code: 'custom',
          path: ['milestones', index, 'phaseKey'],
          message: 'Unknown phase',
        });
    }
    for (const [index, item] of plan.tasks.entries()) {
      const milestone = milestones.get(item.milestoneKey);
      if (!phases.has(item.phaseKey) || !milestone || milestone.phaseKey !== item.phaseKey)
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index, 'milestoneKey'],
          message: 'Task phase and milestone must match',
        });
      const parent = item.parentKey ? tasks.get(item.parentKey) : undefined;
      if (item.kind === 'EPIC' && item.parentKey)
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index, 'parentKey'],
          message: 'An epic cannot have a parent',
        });
      if (item.kind === 'TASK' && (!parent || parent.kind !== 'EPIC'))
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index, 'parentKey'],
          message: 'A task requires an epic parent',
        });
      if (item.kind === 'SUBTASK' && (!parent || parent.kind !== 'TASK'))
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index, 'parentKey'],
          message: 'A subtask requires a task parent',
        });
      if (
        parent &&
        (parent.phaseKey !== item.phaseKey || parent.milestoneKey !== item.milestoneKey)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index, 'parentKey'],
          message: 'Parent must share the milestone',
        });
      if (item.startDate && item.dueDate && new Date(item.startDate) > new Date(item.dueDate))
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index, 'dueDate'],
          message: 'Due date must follow start date',
        });
      if (new Set(item.dependencyKeys).size !== item.dependencyKeys.length)
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index, 'dependencyKeys'],
          message: 'Duplicate dependency',
        });
      for (const dependencyKey of item.dependencyKeys) {
        if (!tasks.has(dependencyKey) || dependencyKey === item.key)
          ctx.addIssue({
            code: 'custom',
            path: ['tasks', index, 'dependencyKeys'],
            message: 'Unknown or self dependency',
          });
      }
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (taskKey: string): boolean => {
      if (visiting.has(taskKey)) return true;
      if (visited.has(taskKey)) return false;
      visiting.add(taskKey);
      if (tasks.get(taskKey)?.dependencyKeys.some(visit)) return true;
      visiting.delete(taskKey);
      visited.add(taskKey);
      return false;
    };
    if ([...tasks.keys()].some(visit))
      ctx.addIssue({
        code: 'custom',
        path: ['tasks'],
        message: 'Dependencies cannot form a cycle',
      });
  });

export const createDocumentPlanSchema = z
  .object({ plan: documentPlanSchema.optional() })
  .default({});
export const reviewDocumentPlanSchema = z.object({ note: z.string().trim().max(2000).optional() });

export type DocumentPlan = z.infer<typeof documentPlanSchema>;
export type CreateDocumentPlanInput = z.infer<typeof createDocumentPlanSchema>;
