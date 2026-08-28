import { describe, it, expect } from 'vitest';
import { publicPostSummarySchema, publicPostDetailSchema, createPostSchema } from './post';

describe('publicPostSummarySchema', () => {
  it('accepts a summary with a nullable category and date', () => {
    expect(
      publicPostSummarySchema.safeParse({
        id: 'p1',
        slug: 'hello',
        title: 'Hello',
        excerpt: 'Intro',
        coverImage: null,
        publishedAt: null,
        category: null,
      }).success,
    ).toBe(true);
  });
});

describe('publicPostDetailSchema', () => {
  it('requires a body', () => {
    expect(
      publicPostDetailSchema.safeParse({
        id: 'p1',
        slug: 'hello',
        title: 'Hello',
        excerpt: 'Intro',
        coverImage: null,
        publishedAt: '2026-01-01T00:00:00.000Z',
        category: { slug: 'news', name: 'News' },
      }).success,
    ).toBe(false);
  });
});

describe('createPostSchema', () => {
  it('defaults isPublished to false and requires a kebab-case slug', () => {
    const parsed = createPostSchema.parse({ slug: 'my-post', title: 'T', excerpt: 'E', body: 'B' });
    expect(parsed.isPublished).toBe(false);
    expect(
      createPostSchema.safeParse({ slug: 'Bad', title: 'T', excerpt: 'E', body: 'B' }).success,
    ).toBe(false);
  });
});
