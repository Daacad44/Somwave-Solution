import { z } from 'zod';

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED'] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Furan',
  IN_PROGRESS: 'Socda',
  WAITING: 'Sugaya',
  RESOLVED: 'La xalliyay',
};

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Hoose',
  MEDIUM: 'Dhexe',
  HIGH: 'Sare',
  URGENT: 'Degdeg',
};

export const adminTicketSchema = z.object({
  id: z.string(),
  code: z.string(),
  subject: z.string(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  createdAt: z.string(),
  client: z.object({ id: z.string(), companyName: z.string() }),
});

export type AdminTicket = z.infer<typeof adminTicketSchema>;

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1, 'Mawduuca waa waajib').max(200),
  description: z.string().trim().min(1, 'Faahfaahin waa waajib').max(8000),
  priority: ticketPrioritySchema.default('MEDIUM'),
  projectId: z.string().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
