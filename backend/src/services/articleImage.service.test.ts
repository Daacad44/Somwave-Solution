import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    mediaAsset: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    post: { count: vi.fn() },
  },
}));
vi.mock('./media-references', () => ({ mediaIsReferenced: vi.fn() }));
vi.mock('../lib/storage', () => ({
  decodeArticleImage: vi.fn(),
  putPublicImage: vi.fn(),
  deleteObject: vi.fn(),
  readObject: vi.fn(),
  storageStatus: vi.fn(() => ({ provider: 'memory', configured: true, durable: false })),
}));
vi.mock('../lib/audit', () => ({ writeAudit: vi.fn(async () => undefined) }));
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn() } }));

import { mediaIsReferenced } from './media-references';
import { prisma } from '../lib/prisma';
import { writeAudit } from '../lib/audit';
import { decodeArticleImage, deleteObject, putPublicImage } from '../lib/storage';
import {
  readPublicArticleImage,
  releaseArticleImageUrl,
  releaseRemovedImages,
  resolveArticleCover,
  uploadArticleImage,
} from './articleImage.service';

const legacyUpload = {
  storageKey: 'article-images/generated.jpg',
  provider: 'legacy' as const,
  fileId: null,
  url: null,
  folder: null,
  width: null,
  height: null,
};

const CDN = 'https://ik.imagekit.io/somwave/somwave/website/portfolio';

function imageKitUpload(name: string) {
  return {
    storageKey: `ik/file_123456/somwave/website/portfolio/${name}`,
    provider: 'imagekit' as const,
    fileId: 'file_123456',
    url: `${CDN}/${name}`,
    folder: 'somwave/website/portfolio',
    width: 1200,
    height: 675,
  };
}

const jpeg = {
  bytes: Buffer.from([0xff, 0xd8, 0xff]),
  mimeType: 'image/jpeg' as const,
  extension: 'jpg' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('uploadArticleImage', () => {
  it('falls back to the API image URL when ImageKit is not configured (development)', async () => {
    vi.mocked(decodeArticleImage).mockReturnValue(jpeg);
    vi.mocked(putPublicImage).mockResolvedValue(legacyUpload);
    vi.mocked(prisma.mediaAsset.create).mockResolvedValue({} as never);

    const result = await uploadArticleImage(
      { fileName: '../../cover.jpg', mimeType: 'image/jpeg', contentBase64: 'abc' },
      'user-1',
      (id) => `https://api.example.com/api/v1/public/article-images/${id}`,
    );

    const data = vi.mocked(prisma.mediaAsset.create).mock.calls[0]![0].data;
    expect(data.id).toMatch(/^[0-9a-f]{32}$/);
    expect(result.url).toBe(`https://api.example.com/api/v1/public/article-images/${data.id}`);
    expect(result.filename).toBe('cover.jpg');
    expect(putPublicImage).toHaveBeenCalledWith(
      jpeg.bytes,
      'image/jpeg',
      'articles',
      `${data.id}.jpg`,
    );
    expect(data).toMatchObject({
      storageKey: 'article-images/generated.jpg',
      fileName: 'cover.jpg',
      collection: 'article-covers',
      provider: 'memory',
      createdById: 'user-1',
    });
  });

  it('stores ImageKit metadata and returns the CDN URL for the module folder', async () => {
    vi.mocked(decodeArticleImage).mockReturnValue(jpeg);
    vi.mocked(putPublicImage).mockImplementation(async (_b, _m, _module, name) =>
      imageKitUpload(name),
    );
    vi.mocked(prisma.mediaAsset.create).mockResolvedValue({} as never);

    const result = await uploadArticleImage(
      { fileName: 'cover.jpg', mimeType: 'image/jpeg', contentBase64: 'abc', module: 'portfolio' },
      'user-1',
      () => 'unused',
    );

    const data = vi.mocked(prisma.mediaAsset.create).mock.calls[0]![0].data;
    expect(result).toMatchObject({ url: `${CDN}/${data.id}.jpg`, width: 1200, height: 675 });
    expect(data).toMatchObject({
      provider: 'imagekit',
      providerFileId: 'file_123456',
      url: `${CDN}/${data.id}.jpg`,
      folder: 'somwave/website/portfolio',
      width: 1200,
      height: 675,
    });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'media.image.uploaded', subjectId: data.id }),
    );
  });

  it('never saves a record when the ImageKit upload fails', async () => {
    vi.mocked(decodeArticleImage).mockReturnValue(jpeg);
    vi.mocked(putPublicImage).mockRejectedValue(new Error('ImageKit down'));
    await expect(
      uploadArticleImage(
        { fileName: 'cover.jpg', mimeType: 'image/jpeg', contentBase64: 'abc' },
        'user-1',
        (id) => id,
      ),
    ).rejects.toThrow('ImageKit down');
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
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
    expect(putPublicImage).not.toHaveBeenCalled();
  });

  it('removes the stored object when the database write fails', async () => {
    vi.mocked(decodeArticleImage).mockReturnValue(jpeg);
    vi.mocked(putPublicImage).mockResolvedValue(legacyUpload);
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

  it('accepts the exact CDN URL recorded at upload and rejects a look-alike host', async () => {
    const id = 'a'.repeat(32);
    const url = `${CDN}/${id}.jpg`;
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({ id, url } as never);
    await expect(resolveArticleCover(url)).resolves.toBe(url);
    await expect(
      resolveArticleCover(`https://evil.example/somwave/website/portfolio/${id}.jpg`),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('keeps an image that is already saved on the article', async () => {
    const current = 'https://cdn.example.com/already.jpg';
    await expect(resolveArticleCover(current, current)).resolves.toBe(current);
    expect(prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
  });
});

describe('releaseArticleImageUrl', () => {
  it('does not delete an image that another article still uses', async () => {
    vi.mocked(mediaIsReferenced).mockResolvedValue(true);
    await releaseArticleImageUrl('https://api.example.com/api/v1/public/article-images/img1');
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('deletes storage only after nothing references the image', async () => {
    vi.mocked(mediaIsReferenced).mockResolvedValue(false);
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({
      id: 'img1',
      storageKey: 'article-images/generated.jpg',
    } as never);
    await releaseArticleImageUrl('https://api.example.com/api/v1/public/article-images/img1');
    expect(deleteObject).toHaveBeenCalledWith('article-images/generated.jpg');
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'img1' } });
  });
});

describe('releaseRemovedImages', () => {
  it('releases only images the save removed', async () => {
    const keep = `${CDN}/${'b'.repeat(32)}.jpg`;
    const drop = `${CDN}/${'c'.repeat(32)}.jpg`;
    vi.mocked(mediaIsReferenced).mockResolvedValue(false);
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({
      id: 'c'.repeat(32),
      storageKey: 'ik/file_123456/somwave/website/portfolio/c.jpg',
    } as never);
    await releaseRemovedImages([keep, drop, null], [keep], 'user-1');
    expect(mediaIsReferenced).toHaveBeenCalledTimes(1);
    expect(mediaIsReferenced).toHaveBeenCalledWith('c'.repeat(32));
    expect(deleteObject).toHaveBeenCalledWith('ik/file_123456/somwave/website/portfolio/c.jpg');
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'media.image.deleted', actorId: 'user-1' }),
    );
  });

  it('never turns a successful save into an error when cleanup fails', async () => {
    vi.mocked(mediaIsReferenced).mockRejectedValue(new Error('db down'));
    await expect(
      releaseRemovedImages([`${CDN}/${'d'.repeat(32)}.jpg`], []),
    ).resolves.toBeUndefined();
  });

  it('keeps the record when ImageKit deletion fails so it can be retried', async () => {
    vi.mocked(mediaIsReferenced).mockResolvedValue(false);
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({
      id: 'e'.repeat(32),
      storageKey: 'ik/file_123456/somwave/website/team/e.jpg',
    } as never);
    vi.mocked(deleteObject).mockRejectedValueOnce(new Error('ImageKit down'));
    await releaseArticleImageUrl(`${CDN}/${'e'.repeat(32)}.jpg`);
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });
});

describe('readPublicArticleImage', () => {
  it('redirects ImageKit-backed rows to the CDN instead of proxying bytes', async () => {
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({
      id: 'img1',
      mimeType: 'image/webp',
      url: `${CDN}/img1.webp`,
      storageKey: 'ik/file_123456/somwave/website/portfolio/img1.webp',
    } as never);
    await expect(readPublicArticleImage('img1')).resolves.toEqual({
      redirect: `${CDN}/img1.webp`,
    });
  });
});
