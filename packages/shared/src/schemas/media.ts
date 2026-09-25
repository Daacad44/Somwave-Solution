import { z } from 'zod';

export const adminMediaAssetSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  alt: z.string().nullable(),
  collection: z.string().nullable(),
  createdAt: z.string(),
});

export type AdminMediaAsset = z.infer<typeof adminMediaAssetSchema>;

export const createMediaAssetSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(120),
  contentBase64: z.string().min(1, 'Faylka waa waajib'),
  alt: z.string().trim().max(200).optional(),
  collection: z.string().trim().max(80).optional(),
});

export type CreateMediaAssetInput = z.infer<typeof createMediaAssetSchema>;
