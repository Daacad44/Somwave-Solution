import { describe, it, expect, vi } from 'vitest';
import {
  decodeArticleImage,
  decodeUpload,
  putArticleImage,
  readObject,
  deleteObject,
} from './storage';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

describe('decodeArticleImage', () => {
  it('accepts a jpeg whose magic bytes match the claimed type', () => {
    const decoded = decodeArticleImage(JPEG.toString('base64'), 'image/jpeg');
    expect(decoded.mimeType).toBe('image/jpeg');
    expect(decoded.extension).toBe('jpg');
    expect(decoded.bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it('accepts a signed gif and rejects a gif or png claimed as jpeg', () => {
    expect(decodeArticleImage(GIF.toString('base64'), 'image/gif').extension).toBe('gif');
    expect(() => decodeArticleImage(GIF.toString('base64'), 'image/jpeg')).toThrow(
      /JPG, PNG, WebP, or GIF/,
    );
    expect(() => decodeArticleImage(PNG.toString('base64'), 'image/jpeg')).toThrow(
      /JPG, PNG, WebP, or GIF/,
    );
  });
});

describe('shared upload validation', () => {
  it('accepts WebP and rejects a spoofed PNG signature and oversized image', () => {
    const webp = Buffer.from('RIFF0000WEBP');
    expect(decodeUpload(webp.toString('base64'), 'image/webp')).toEqual(webp);
    expect(() =>
      decodeUpload(Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'), 'image/png'),
    ).toThrow(/does not match/);
    expect(() =>
      decodeArticleImage(Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64'), 'image/jpeg'),
    ).toThrow(/5 MB/);
  });
});

describe('article image storage', () => {
  it('stores and reads bytes under a generated key, then deletes them', async () => {
    const key = await putArticleImage(JPEG, 'image/jpeg', 'jpg');
    expect(key.startsWith('article-images/')).toBe(true);
    expect(key.endsWith('.jpg')).toBe(true);
    expect(key.includes('..')).toBe(false);
    const stored = await readObject(key);
    expect(stored?.equals(JPEG)).toBe(true);
    await deleteObject(key);
    expect(await readObject(key)).toBeNull();
    expect(await readObject('../etc/passwd')).toBeNull();
  });
});

describe('persistent filesystem storage', () => {
  it('retains public images and private objects across module reload and removes them safely', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { env } = await import('./env');
    const path = await mkdtemp(join(tmpdir(), 'somwave-storage-'));
    const previous = { provider: env.STORAGE_PROVIDER, path: env.STORAGE_LOCAL_PATH };
    env.STORAGE_PROVIDER = 'filesystem';
    env.STORAGE_LOCAL_PATH = path;
    try {
      const key = await putArticleImage(JPEG, 'image/jpeg', 'jpg');
      // A fresh module has an empty memory map; bytes must come from disk.
      vi.resetModules();
      vi.stubEnv('STORAGE_PROVIDER', 'filesystem');
      vi.stubEnv('STORAGE_LOCAL_PATH', path);
      const fresh = await import('./storage');
      expect((await fresh.readObject(key))?.equals(JPEG)).toBe(true);
      expect(fresh.storageStatus()).toEqual({
        provider: 'filesystem',
        configured: true,
        durable: true,
      });
      expect(await fresh.readObject('../etc/passwd')).toBeNull();
      const { symlink, unlink } = await import('node:fs/promises');
      const maliciousKey = 'obj/00000000-0000-0000-0000-000000000000';
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(path, 'obj'), { recursive: true });
      await symlink('/etc/passwd', join(path, maliciousKey));
      await expect(fresh.readObject(maliciousKey)).rejects.toMatchObject({ status: 503 });
      await unlink(join(path, maliciousKey));
      await fresh.deleteObject(key);
      expect(await fresh.readObject(key)).toBeNull();
      const privateKey = await fresh.putObject(PNG, 'image/png');
      expect((await fresh.readObject(privateKey))?.equals(PNG)).toBe(true);
      await fresh.deleteObject(privateKey);
    } finally {
      env.STORAGE_PROVIDER = previous.provider;
      env.STORAGE_LOCAL_PATH = previous.path;
      vi.unstubAllEnvs();
      await rm(path, { recursive: true, force: true });
    }
  });

  it('fails closed when production storage has no configured provider', async () => {
    const { env } = await import('./env');
    const previous = { node: env.NODE_ENV, provider: env.STORAGE_PROVIDER, bucket: env.S3_BUCKET };
    env.NODE_ENV = 'production';
    env.STORAGE_PROVIDER = undefined;
    env.S3_BUCKET = undefined;
    try {
      const fresh = await import('./storage');
      await expect(fresh.putObject(JPEG, 'image/jpeg')).rejects.toMatchObject({ status: 503 });
      // Defense in depth even if a caller bypasses the Zod env type at runtime.
      Object.assign(env, { STORAGE_PROVIDER: 'memory' });
      expect(fresh.storageStatus().configured).toBe(false);
      await expect(fresh.putObject(JPEG, 'image/jpeg')).rejects.toMatchObject({ status: 503 });
    } finally {
      env.NODE_ENV = previous.node;
      env.STORAGE_PROVIDER = previous.provider;
      env.S3_BUCKET = previous.bucket;
    }
  });
});
