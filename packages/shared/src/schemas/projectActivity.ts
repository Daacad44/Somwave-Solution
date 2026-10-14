import { z } from 'zod';

export const projectActivitySchema = z.array(
  z.object({
    id: z.string(),
    action: z.string(),
    resourceType: z.string(),
    resourceId: z.string().nullable(),
    actorId: z.string().nullable(),
    actorName: z.string().nullable(),
    occurredAt: z.string(),
  }),
);
export type ProjectActivity = z.infer<typeof projectActivitySchema>;
