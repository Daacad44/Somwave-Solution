import { z } from 'zod';

export const adminDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  clientId: z.string().nullable(),
  createdAt: z.string(),
});

export type AdminDocument = z.infer<typeof adminDocumentSchema>;

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Cinwaanka waa waajib').max(200),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(120),
  contentBase64: z.string().min(1, 'Faylka waa waajib'),
  clientId: z.string().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
