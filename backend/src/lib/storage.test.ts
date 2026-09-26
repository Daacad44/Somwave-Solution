import { describe, it, expect } from 'vitest';
import { decodeArticleImage, putArticleImage, readObject, deleteObject } from './storage';

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

  it('rejects a gif and a png claimed as jpeg', () => {
    expect(() => decodeArticleImage(GIF.toString('base64'), 'image/jpeg')).toThrow(
      /JPG, PNG ama WEBP/,
    );
    expect(() => decodeArticleImage(PNG.toString('base64'), 'image/jpeg')).toThrow(
      /JPG, PNG ama WEBP/,
    );
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
