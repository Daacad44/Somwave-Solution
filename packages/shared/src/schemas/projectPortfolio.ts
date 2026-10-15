import { z } from 'zod';
import { adminProjectSchema } from './project';
import { projectHealthSchema } from './workspace';

export const projectPortfolioItemSchema = adminProjectSchema.extend({
  clientName: z.string().nullable(),
  health: projectHealthSchema,
  progress: z.number().int().min(0).max(100).nullable(),
  taskCount: z.number().int().nonnegative(),
  overdueTasks: z.number().int().nonnegative(),
  assignedEngineers: z.number().int().nonnegative(),
  pendingInvitations: z.number().int().nonnegative(),
  assignmentStatus: z.enum(['ACTIVE', 'PENDING', 'UNASSIGNED']),
});
export type ProjectPortfolioItem = z.infer<typeof projectPortfolioItemSchema>;

export const projectPortfolioSchema = z.object({
  items: z.array(projectPortfolioItemSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  filters: z.object({
    managers: z.array(z.object({ id: z.string(), name: z.string() })),
    engineers: z.array(z.object({ id: z.string(), name: z.string() })),
    clients: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
  summary: z.object({
    totalProjects: z.number().int(),
    activeProjects: z.number().int(),
    completedProjects: z.number().int(),
    planningProjects: z.number().int(),
    delayedProjects: z.number().int(),
    atRiskProjects: z.number().int(),
    assignedEngineers: z.number().int(),
    unassignedProjects: z.number().int(),
    projectsWithPendingInvitations: z.number().int(),
    projectsWithActiveTeams: z.number().int(),
    overdueTasks: z.number().int(),
    upcomingDeadlines: z.number().int(),
  }),
});
export type ProjectPortfolio = z.infer<typeof projectPortfolioSchema>;
