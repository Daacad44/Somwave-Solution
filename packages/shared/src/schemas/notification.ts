import { z } from 'zod';

export const adminNotificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export type AdminNotification = z.infer<typeof adminNotificationSchema>;
