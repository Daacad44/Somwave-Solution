import { z } from 'zod';
import { newPasswordSchema } from './password';

export const projectInquiryStatusSchema = z.enum([
  'PENDING_VERIFICATION',
  'EMAIL_VERIFIED',
  'ACCOUNT_CREATED',
  'UNDER_REVIEW',
  'PROPOSAL_SENT',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'CONVERTED',
]);
export type ProjectInquiryStatus = z.infer<typeof projectInquiryStatusSchema>;

export const createProjectInquirySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(40).optional(),
  companyName: z.string().trim().max(200).optional(),
  projectType: z.string().trim().min(1).max(120),
  portfolioItemId: z.string().trim().optional(),
  description: z.string().trim().min(10).max(5000),
  desiredFeatures: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  estimatedBudget: z.string().trim().max(100).optional(),
  expectedTimeline: z.string().trim().max(100).optional(),
  website: z.string().trim().max(200).optional(),
});
export type CreateProjectInquiryInput = z.infer<typeof createProjectInquirySchema>;

export const verifyProjectInquirySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code'),
});
export const activateProjectInquirySchema = z
  .object({
    activationToken: z.string().min(32).max(128),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export const reviewProjectInquirySchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'PROPOSAL_SENT', 'REJECTED', 'CANCELLED']),
  proposalSummary: z.string().trim().min(20).max(5000).optional(),
});
export const convertProjectInquirySchema = z.object({
  managerId: z.string().nullable().optional(),
});

const attachmentPayloadSchema = z.object({
  fileName: z.string().trim().min(1).max(120),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  contentBase64: z
    .string()
    .min(4)
    .max(6_990_508)
    .refine(
      (value) => value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value),
      'Enter valid base64 file content',
    ),
});

export const uploadPublicProjectInquiryAttachmentSchema = attachmentPayloadSchema.extend({
  activationToken: z.string().min(32).max(128),
});
export const uploadClientProjectInquiryAttachmentSchema = attachmentPayloadSchema;
export type ProjectInquiryAttachmentInput = z.infer<typeof attachmentPayloadSchema>;

export const projectInquiryAttachmentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type ProjectInquiryAttachment = z.infer<typeof projectInquiryAttachmentSchema>;

export const projectInquirySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  companyName: z.string().nullable(),
  projectType: z.string(),
  portfolioItemId: z.string().nullable(),
  description: z.string(),
  desiredFeatures: z.array(z.string()),
  estimatedBudget: z.string().nullable(),
  expectedTimeline: z.string().nullable(),
  status: projectInquiryStatusSchema,
  projectId: z.string().nullable(),
  proposalSummary: z.string().nullable(),
  createdAt: z.string(),
});
export type ProjectInquirySummary = z.infer<typeof projectInquirySummarySchema>;
