import { z } from 'zod';

export const DOCUMENTATION_FORMATS = ['MARKDOWN', 'RICH_TEXT', 'FILE'] as const;
export const DOCUMENTATION_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED'] as const;
export const documentationFormatSchema = z.enum(DOCUMENTATION_FORMATS);
export const documentationStatusSchema = z.enum(DOCUMENTATION_STATUSES);

const title = z.string().trim().min(1).max(200);
const location = z.string().trim().max(200).nullable().optional();

export const createProjectDocumentationSchema = z
  .object({
    title,
    category: location,
    folder: location,
    format: documentationFormatSchema,
    content: z.string().max(500_000).optional(),
    fileName: z.string().trim().min(1).max(200).optional(),
    mimeType: z.string().trim().min(1).max(120).optional(),
    contentBase64: z.string().min(1).optional(),
    ownerId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.format === 'FILE' && (!value.fileName || !value.mimeType || !value.contentBase64)) {
      ctx.addIssue({ code: 'custom', message: 'A file, name, and MIME type are required' });
    }
    if (value.format !== 'FILE' && value.content === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Document content is required' });
    }
    if (value.format !== 'FILE' && value.contentBase64) {
      ctx.addIssue({ code: 'custom', message: 'Files require FILE format' });
    }
  });

export type CreateProjectDocumentationInput = z.infer<typeof createProjectDocumentationSchema>;

export const updateProjectDocumentationSchema = z
  .object({
    title: title.optional(),
    category: location,
    folder: location,
    content: z.string().max(500_000).optional(),
    fileName: z.string().trim().min(1).max(200).optional(),
    mimeType: z.string().trim().min(1).max(120).optional(),
    contentBase64: z.string().min(1).optional(),
    ownerId: z.string().nullable().optional(),
    expectedVersion: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 1) {
      ctx.addIssue({ code: 'custom', message: 'At least one change is required' });
    }
    if (value.contentBase64 && (!value.fileName || !value.mimeType)) {
      ctx.addIssue({ code: 'custom', message: 'A file name and MIME type are required' });
    }
    if (!value.contentBase64 && (value.fileName || value.mimeType)) {
      ctx.addIssue({ code: 'custom', message: 'File metadata requires a file upload' });
    }
  });

export type UpdateProjectDocumentationInput = z.infer<typeof updateProjectDocumentationSchema>;

export const changeProjectDocumentationStatusSchema = z.object({
  status: documentationStatusSchema,
  expectedVersion: z.number().int().positive(),
});

export type ChangeProjectDocumentationStatusInput = z.infer<
  typeof changeProjectDocumentationStatusSchema
>;

export const projectDocumentationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  folder: z.string().nullable(),
  format: documentationFormatSchema,
  content: z.string().nullable(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  status: documentationStatusSchema,
  currentVersion: z.number().int(),
  ownerId: z.string().nullable(),
  createdById: z.string(),
  updatedById: z.string().nullable(),
  approvedById: z.string().nullable(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectDocumentation = z.infer<typeof projectDocumentationSchema>;

export const documentationVersionSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  title: z.string(),
  content: z.string().nullable(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  status: documentationStatusSchema,
  approvedById: z.string().nullable(),
  approvedAt: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.string(),
});

export type DocumentationVersionRecord = z.infer<typeof documentationVersionSchema>;

export const createDocumentationCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});

export const updateDocumentationCommentSchema = createDocumentationCommentSchema;

export const documentationCommentSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  authorId: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DocumentationCommentRecord = z.infer<typeof documentationCommentSchema>;

export const documentationLinkSchema = z.object({
  targetId: z.string().trim().min(1).max(100),
});

export const documentationAttachmentSchema = z.object({
  fileDocumentId: z.string().trim().min(1).max(100),
});

export const documentationLinksSchema = z.object({
  taskIds: z.array(z.string()),
  milestoneIds: z.array(z.string()),
});

export type DocumentationLinks = z.infer<typeof documentationLinksSchema>;

export const renameDocumentationFolderSchema = z.object({
  from: z.string().trim().min(1).max(200),
  to: z.string().trim().min(1).max(200),
});
