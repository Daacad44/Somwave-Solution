import { z } from 'zod';

// Website enquiry form (SYSTEM_PROMPT §11). The same schema drives the form on
// the client and validate() on the server. User-facing messages are Somali (§15).
export const createInquirySchema = z.object({
  name: z.string().trim().min(1, 'Magaca waa waajib').max(120),
  email: z.string().trim().email('Fadlan geli iimayl sax ah'),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10, 'Fariintu waa inay ka badan tahay 10 xaraf').max(4000),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
