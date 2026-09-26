import { z } from 'zod';
import { adminMilestoneSchema } from './milestone';
import { adminProjectSchema, projectStatusSchema } from './project';
import { adminTaskSchema } from './task';
import { invoiceStatusSchema } from './invoice';
import { ticketPrioritySchema, ticketStatusSchema } from './ticket';
import { adminClientSchema } from './client';

export const PROJECT_HEALTH = [
  'ON_TRACK',
  'AT_RISK',
  'OVERDUE',
  'COMPLETE',
  'CANCELLED',
  'NO_DATE',
] as const;
export const projectHealthSchema = z.enum(PROJECT_HEALTH);
export type ProjectHealth = z.infer<typeof projectHealthSchema>;

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  ON_TRACK: 'Waddada saxda',
  AT_RISK: 'Khatar',
  OVERDUE: 'Dib u dhacay',
  COMPLETE: 'Dhammaystiran',
  CANCELLED: 'La baabi’iyay',
  NO_DATE: 'Taariikh ma leh',
};

export const projectWorkspaceSchema = z.object({
  project: adminProjectSchema.extend({
    clientName: z.string().nullable(),
  }),
  progress: z.number().int().min(0).max(100).nullable(),
  health: projectHealthSchema,
  taskCounts: z.object({
    total: z.number().int(),
    done: z.number().int(),
    open: z.number().int(),
  }),
  tasks: z.array(adminTaskSchema),
  milestones: z.array(adminMilestoneSchema),
});

export type ProjectWorkspace = z.infer<typeof projectWorkspaceSchema>;

export const clientProjectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: projectStatusSchema,
  dueDate: z.string().nullable(),
  progress: z.number().int().min(0).max(100).nullable(),
});

export const clientInvoiceSummarySchema = z.object({
  id: z.string(),
  number: z.string(),
  status: invoiceStatusSchema,
  total: z.string(),
  dueDate: z.string(),
});

export const clientTicketSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  subject: z.string(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
});

export const clientDocumentSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
});

export const clientProfileSchema = adminClientSchema.extend({
  projects: z.array(clientProjectSummarySchema),
  invoices: z.array(clientInvoiceSummarySchema),
  tickets: z.array(clientTicketSummarySchema),
  documents: z.array(clientDocumentSummarySchema),
});

export type ClientProfile = z.infer<typeof clientProfileSchema>;

export const SEARCH_TYPES = [
  'project',
  'task',
  'client',
  'lead',
  'ticket',
  'invoice',
  'user',
  'service',
  'article',
  'document',
] as const;
export const searchTypeSchema = z.enum(SEARCH_TYPES);
export type SearchType = z.infer<typeof searchTypeSchema>;

export const searchHitSchema = z.object({
  id: z.string(),
  type: searchTypeSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  href: z.string(),
});

export type SearchHit = z.infer<typeof searchHitSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
