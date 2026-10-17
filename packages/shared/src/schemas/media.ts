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
  contentBase64: z.string().min(1, 'File is required'),
  alt: z.string().trim().max(200).optional(),
  collection: z.string().trim().max(80).optional(),
});

export type CreateMediaAssetInput = z.infer<typeof createMediaAssetSchema>;

/** GET /media/storage-status — configuration state only, never credentials. */
export const mediaStorageStatusSchema = z.object({
  images: z.object({
    provider: z.literal('imagekit'),
    configured: z.boolean(),
    reachable: z.boolean().nullable(),
    urlEndpointHost: z.string().nullable(),
    error: z.string().optional(),
  }),
  documents: z.object({
    provider: z.string(),
    configured: z.boolean(),
    durable: z.boolean(),
  }),
});

export type MediaStorageStatus = z.infer<typeof mediaStorageStatusSchema>;
