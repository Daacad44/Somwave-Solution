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

export const INQUIRY_STATUSES = ['NEW', 'READ', 'ARCHIVED'] as const;
export const inquiryStatusSchema = z.enum(INQUIRY_STATUSES);
export type InquiryStatus = z.infer<typeof inquiryStatusSchema>;

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: 'Cusub',
  READ: 'La akhriyay',
  ARCHIVED: 'Kaydsan',
};

export const adminInquirySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  message: z.string(),
  status: inquiryStatusSchema,
  createdAt: z.string(),
});

export type AdminInquiry = z.infer<typeof adminInquirySchema>;

export const updateInquirySchema = z.object({
  status: inquiryStatusSchema,
});

export type UpdateInquiryInput = z.infer<typeof updateInquirySchema>;
