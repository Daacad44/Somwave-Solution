import { z } from 'zod';

// Newsletter subscribers (W5.4). The public subscribe form submits an email;
// staff view/remove the list from the CMS (content.*). Shared by the public API,
// the CMS UI, and validate().

// Public subscribe payload — just an email (§11).
export const createSubscriberSchema = z.object({
  email: z.string().trim().email('Fadlan geli iimayl sax ah').max(200),
});

export type CreateSubscriberInput = z.infer<typeof createSubscriberSchema>;

// Admin view of a subscriber — never exposed publicly.
export const adminSubscriberSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  isActive: z.boolean(),
  createdAt: z.string(), // ISO 8601
});

export type AdminSubscriber = z.infer<typeof adminSubscriberSchema>;
