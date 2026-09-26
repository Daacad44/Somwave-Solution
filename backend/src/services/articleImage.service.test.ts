import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    mediaAsset: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    post: { count: vi.fn() },
  },
}));
vi.mock('../lib/storage', () => ({
  decodeArticleImage: vi.fn(),
  putArticleImage: vi.fn(),
  deleteObject: vi.fn(),
  readObject: vi.fn(),
}));
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { decodeArticleImage, deleteObject, putArticleImage } from '../lib/storage';
import {
  releaseArticleImageUrl,
  resolveArticleCover,
  uploadArticleImage,
} from './articleImage.service';

const jpeg = {
  bytes: Buffer.from([0xff, 0xd8, 0xff]),
  mimeType: 'image/jpeg' as const,
  extension: 'jpg' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('uploadArticleImage', () => {
  it('stores a generated key and returns a public article-image URL', async () => {
    vi.mocked(decodeArticleImage).mockReturnValue(jpeg);
    vi.mocked(putArticleImage).mockResolvedValue('article-images/generated.jpg');
    vi.mocked(prisma.mediaAsset.create).mockResolvedValue({ id: 'img1' } as never);

    const result = await uploadArticleImage(
      { fileName: '../../cover.jpg', mimeType: 'image/jpeg', contentBase64: 'abc' },
      'user-1',
      (id) => `https://api.example.com/api/v1/public/article-images/${id}`,
    );

    expect(result.url).toBe('https://api.example.com/api/v1/public/article-images/img1');
    expect(result.filename).toBe('cover.jpg');
    expect(putArticleImage).toHaveBeenCalledWith(jpeg.bytes, 'image/jpeg', 'jpg');
    expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storageKey: 'article-images/generated.jpg',
          fileName: 'cover.jpg',
          collection: 'article-covers',
          createdById: 'user-1',
        }),
      }),
    );
  });

  it('rejects a file extension that does not match the detected type', async () => {
    vi.mocked(decodeArticleImage).mockReturnValue(jpeg);
    await expect(
      uploadArticleImage(
        { fileName: 'cover.png', mimeType: 'image/jpeg', contentBase64: 'abc' },
        'user-1',
        (id) => id,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(putArticleImage).not.toHaveBeenCalled();
  });

  it('removes the stored object when the database write fails', async () => {
    vi.mocked(decodeArticleImage).mockReturnValue(jpeg);
    vi.mocked(putArticleImage).mockResolvedValue('article-images/generated.jpg');
    vi.mocked(prisma.mediaAsset.create).mockRejectedValue(new Error('db down'));

    await expect(
      uploadArticleImage(
        { fileName: 'cover.jpg', mimeType: 'image/jpeg', contentBase64: 'abc' },
        'user-1',
        (id) => id,
      ),
    ).rejects.toThrow('db down');
    expect(deleteObject).toHaveBeenCalledWith('article-images/generated.jpg');
  });
});

describe('resolveArticleCover', () => {
  it('rejects a pasted external URL', async () => {
    await expect(resolveArticleCover('https://cdn.example.com/a.jpg')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('keeps an image that is already saved on the article', async () => {
    const current = 'https://cdn.example.com/already.jpg';
    await expect(resolveArticleCover(current, current)).resolves.toBe(current);
    expect(prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
  });
});

describe('releaseArticleImageUrl', () => {
  it('does not delete an image that another article still uses', async () => {
    vi.mocked(prisma.post.count).mockResolvedValue(1 as never);
    await releaseArticleImageUrl('https://api.example.com/api/v1/public/article-images/img1');
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('deletes storage only after nothing references the image', async () => {
    vi.mocked(prisma.post.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({
      id: 'img1',
      storageKey: 'article-images/generated.jpg',
    } as never);
    await releaseArticleImageUrl('https://api.example.com/api/v1/public/article-images/img1');
    expect(deleteObject).toHaveBeenCalledWith('article-images/generated.jpg');
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'img1' } });
  });
});
