import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const imagekit = vi.hoisted(() => ({
  configured: true,
  uploadToImageKit: vi.fn(),
  deleteFromImageKit: vi.fn(),
  readFromImageKit: vi.fn(),
}));

vi.mock('./imagekit', () => ({
  imageKitConfigured: () => imagekit.configured,
  uploadToImageKit: imagekit.uploadToImageKit,
  deleteFromImageKit: imagekit.deleteFromImageKit,
  readFromImageKit: imagekit.readFromImageKit,
}));

import { env } from './env';
import { deleteObject, parseImageKitKey, putObject, putPublicImage, readObject } from './storage';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PDF = Buffer.from('%PDF-1.7');
const NAME = `${'b'.repeat(32)}.jpg`;

beforeEach(() => {
  vi.clearAllMocks();
  imagekit.configured = true;
  imagekit.uploadToImageKit.mockImplementation(async ({ module }: { module: string }) => ({
    fileId: 'file_0123456789',
    filePath:
      module === 'portfolio'
        ? `somwave/website/portfolio/${NAME}`
        : `somwave/private/projects/attachments/${NAME}`,
    url:
      module === 'portfolio' ? `https://ik.imagekit.io/acme/somwave/website/portfolio/${NAME}` : '',
    width: 10,
    height: 20,
    size: 4,
  }));
});

afterEach(() => {
  env.NODE_ENV = 'test';
});

describe('image routing', () => {
  it('stores private module images in ImageKit and keeps id and path in the key', async () => {
    const key = await putObject(JPEG, 'image/jpeg', 'project-attachments');
    expect(imagekit.uploadToImageKit).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'project-attachments', mimeType: 'image/jpeg' }),
    );
    expect(key).toBe(`ik/file_0123456789/somwave/private/projects/attachments/${NAME}`);
    expect(parseImageKitKey(key)).toEqual({
      fileId: 'file_0123456789',
      filePath: `somwave/private/projects/attachments/${NAME}`,
    });
  });

  it('keeps PDFs and other documents off ImageKit', async () => {
    const key = await putObject(PDF, 'application/pdf', 'documents');
    expect(key).toMatch(/^obj\//);
    expect(imagekit.uploadToImageKit).not.toHaveBeenCalled();
  });

  it('returns CDN metadata for public website images', async () => {
    const stored = await putPublicImage(JPEG, 'image/jpeg', 'portfolio', NAME);
    expect(stored).toEqual({
      storageKey: `ik/file_0123456789/somwave/website/portfolio/${NAME}`,
      provider: 'imagekit',
      fileId: 'file_0123456789',
      url: `https://ik.imagekit.io/acme/somwave/website/portfolio/${NAME}`,
      folder: 'somwave/website/portfolio',
      width: 10,
      height: 20,
    });
  });

  it('never falls back to local storage for images in production', async () => {
    imagekit.configured = false;
    env.NODE_ENV = 'production';
    await expect(putPublicImage(JPEG, 'image/jpeg', 'articles', NAME)).rejects.toMatchObject({
      status: 503,
      details: { reason: 'IMAGEKIT_NOT_CONFIGURED' },
    });
    await expect(putObject(JPEG, 'image/jpeg', 'media')).rejects.toMatchObject({ status: 503 });
    expect(imagekit.uploadToImageKit).not.toHaveBeenCalled();
  });

  it('uses the in-memory provider for images in development when ImageKit is absent', async () => {
    imagekit.configured = false;
    const stored = await putPublicImage(JPEG, 'image/jpeg', 'articles', NAME);
    expect(stored.provider).toBe('legacy');
    expect(stored.url).toBeNull();
    expect((await readObject(stored.storageKey))?.equals(JPEG)).toBe(true);
  });

  it('routes reads and deletes of ImageKit keys to ImageKit', async () => {
    const key = `ik/file_0123456789/somwave/private/media/${NAME}`;
    imagekit.readFromImageKit.mockResolvedValue(Buffer.from('remote'));
    expect((await readObject(key))?.toString()).toBe('remote');
    expect(imagekit.readFromImageKit).toHaveBeenCalledWith(
      `somwave/private/media/${NAME}`,
      'private/media',
    );
    await deleteObject(key);
    expect(imagekit.deleteFromImageKit).toHaveBeenCalledWith('file_0123456789', 'private/media');
  });

  it('rejects ImageKit keys that try to leave the somwave folders', () => {
    expect(parseImageKitKey(`ik/file_0123456789/somwave/../secret/${NAME}`)).toBeNull();
    expect(parseImageKitKey(`ik/file_0123456789/other/website/${NAME}`)).toBeNull();
    expect(parseImageKitKey(`ik/../somwave/website/articles/${NAME}`)).toBeNull();
  });
});
