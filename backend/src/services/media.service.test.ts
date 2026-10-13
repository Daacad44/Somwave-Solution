import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: { mediaAsset: { findUnique: vi.fn() } },
}));
vi.mock('../lib/storage', () => ({ readObject: vi.fn(async () => Buffer.from('image-bytes')) }));

import { prisma } from '../lib/prisma';
import { readObject } from '../lib/storage';
import { getMediaFile } from './media.service';

describe('getMediaFile', () => {
  it('loads bytes from the S3-capable storage reader', async () => {
    vi.mocked(prisma.mediaAsset.findUnique).mockResolvedValue({
      id: 'media_1',
      storageKey: 'obj/image',
      mimeType: 'image/png',
      fileName: 'image.png',
    } as never);
    const file = await getMediaFile('media_1');
    expect(readObject).toHaveBeenCalledWith('obj/image');
    expect(file.bytes.toString()).toBe('image-bytes');
  });
});
