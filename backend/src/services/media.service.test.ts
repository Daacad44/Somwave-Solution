import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: { mediaAsset: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() } },
}));
vi.mock('./media-references', () => ({ mediaIsReferenced: vi.fn(async () => false) }));
vi.mock('../lib/storage', () => ({
  readObject: vi.fn(async () => Buffer.from('image-bytes')),
  deleteObject: vi.fn(),
  putObject: vi.fn(),
  decodeUpload: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { mediaIsReferenced } from './media-references';
import { deleteObject, readObject } from '../lib/storage';
import { getMediaFile, deleteMedia, createMedia } from './media.service';

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

describe('media deletion', () => {
  it('refuses to delete a referenced CMS image', async () => {
    vi.mocked(prisma.mediaAsset.findUnique).mockResolvedValue({
      id: 'img1',
      storageKey: 'article-images/object.jpg',
    } as never);
    vi.mocked(mediaIsReferenced).mockResolvedValue(true);
    await expect(deleteMedia('img1')).rejects.toMatchObject({ status: 409 });
    expect(deleteObject).not.toHaveBeenCalled();
  });
  it('deletes stored bytes before removing unreferenced metadata', async () => {
    vi.mocked(prisma.mediaAsset.findUnique).mockResolvedValue({
      id: 'img1',
      storageKey: 'obj/key',
    } as never);
    vi.mocked(mediaIsReferenced).mockResolvedValue(false);
    await deleteMedia('img1');
    expect(deleteObject).toHaveBeenCalledWith('obj/key');
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'img1' } });
  });
});

describe('public collection boundary', () => {
  it('does not permit private media uploads to opt into the public CMS collection', async () => {
    await expect(
      createMedia(
        {
          fileName: 'file.pdf',
          mimeType: 'application/pdf',
          contentBase64: 'abc',
          collection: 'article-covers',
        },
        'actor',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
