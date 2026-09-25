import { z } from 'zod';

export const adminAuditLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  subjectType: z.string(),
  subjectId: z.string().nullable(),
  actorId: z.string().nullable(),
  createdAt: z.string(),
});

export type AdminAuditLog = z.infer<typeof adminAuditLogSchema>;
