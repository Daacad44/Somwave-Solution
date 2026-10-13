import { z } from 'zod';

export const adminAuditLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  subjectType: z.string(),
  subjectId: z.string().nullable(),
  actorId: z.string().nullable(),
  correlationId: z.string().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  createdAt: z.string(),
});

export type AdminAuditLog = z.infer<typeof adminAuditLogSchema>;
