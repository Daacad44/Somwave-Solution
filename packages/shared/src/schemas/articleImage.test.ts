import { describe, it, expect } from 'vitest';
import {
  articleImageFileError,
  isStoredArticleImageUrl,
  uploadArticleImageSchema,
} from './articleImage';

describe('articleImageFileError', () => {
  it('accepts jpeg, png, and webp within 5MB', () => {
    expect(articleImageFileError({ name: 'cover.jpg', type: 'image/jpeg', size: 1800 })).toBeNull();
    expect(
      articleImageFileError({ name: 'cover.jpeg', type: 'image/jpeg', size: 1800 }),
    ).toBeNull();
    expect(articleImageFileError({ name: 'cover.png', type: 'image/png', size: 1800 })).toBeNull();
    expect(
      articleImageFileError({ name: 'cover.webp', type: 'image/webp', size: 1800 }),
    ).toBeNull();
  });

  it('accepts gif and rejects documents, svg, and oversized files', () => {
    expect(articleImageFileError({ name: 'anim.gif', type: 'image/gif', size: 100 })).toBeNull();
    expect(
      articleImageFileError({ name: 'notes.pdf', type: 'application/pdf', size: 100 }),
    ).toMatch(/JPG, PNG, WebP, or GIF/);
    expect(articleImageFileError({ name: 'icon.svg', type: 'image/svg+xml', size: 100 })).toMatch(
      /JPG, PNG, WebP, or GIF/,
    );
    expect(
      articleImageFileError({ name: 'huge.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }),
    ).toMatch(/5 MB/);
  });
});

describe('isStoredArticleImageUrl', () => {
  it('accepts only the public article-image path', () => {
    expect(
      isStoredArticleImageUrl('https://api.example.com/api/v1/public/article-images/abc123'),
    ).toBe(true);
    expect(isStoredArticleImageUrl('https://cdn.example.com/a.jpg')).toBe(false);
    expect(
      isStoredArticleImageUrl('https://api.example.com/api/v1/public/article-images/../a'),
    ).toBe(false);
  });

  it('recognises ImageKit delivery URLs for uploaded website images only', () => {
    const id = 'f'.repeat(32);
    expect(
      isStoredArticleImageUrl(`https://ik.imagekit.io/acme/somwave/website/articles/${id}.webp`),
    ).toBe(true);
    // Custom CDN domain without the ImageKit id segment.
    expect(
      isStoredArticleImageUrl(`https://img.example.com/somwave/branding/logos/${id}.png`),
    ).toBe(true);
    // Private folders, transformations, plain http and other paths are not public uploads.
    expect(
      isStoredArticleImageUrl(`https://ik.imagekit.io/acme/somwave/private/media/${id}.png`),
    ).toBe(false);
    expect(
      isStoredArticleImageUrl(`https://ik.imagekit.io/acme/somwave/website/team/${id}.png?tr=w-1`),
    ).toBe(false);
    expect(
      isStoredArticleImageUrl(`http://ik.imagekit.io/acme/somwave/website/team/${id}.png`),
    ).toBe(false);
    expect(isStoredArticleImageUrl(`https://ik.imagekit.io/acme/${id}.png`)).toBe(false);
  });
});

describe('uploadArticleImageSchema', () => {
  it('requires a file payload', () => {
    expect(
      uploadArticleImageSchema.safeParse({
        fileName: 'cover.jpg',
        mimeType: 'image/jpeg',
        contentBase64: 'abc',
      }).success,
    ).toBe(true);
    expect(
      uploadArticleImageSchema.safeParse({
        fileName: 'cover.jpg',
        mimeType: 'image/svg+xml',
        contentBase64: 'abc',
      }).success,
    ).toBe(false);
  });
});
