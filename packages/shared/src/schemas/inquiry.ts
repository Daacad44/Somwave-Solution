import { z } from 'zod';

// Website enquiry form (SYSTEM_PROMPT §11). The same schema drives the form on
// the client and validate() on the server.
export const createInquirySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(4000),
  // Honeypot — browsers leave this empty; bots often fill it.
  website: z.string().trim().max(200).optional(),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

export const INQUIRY_STATUSES = ['NEW', 'READ', 'ARCHIVED'] as const;
export const inquiryStatusSchema = z.enum(INQUIRY_STATUSES);
export type InquiryStatus = z.infer<typeof inquiryStatusSchema>;

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: 'New',
  READ: 'Read',
  ARCHIVED: 'Archived',
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
