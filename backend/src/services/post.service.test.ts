import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: { post: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() } },
}));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { listPublishedPosts, getPostBySlug } from './post.service';

const published = new Date('2026-01-02T00:00:00.000Z');
const row = {
  id: 'p1',
  slug: 'hello',
  title: 'Hello',
  excerpt: 'Intro',
  coverImage: null,
  publishedAt: published,
  category: { slug: 'news', name: 'News' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.get).mockResolvedValue(null);
});

describe('listPublishedPosts', () => {
  it('maps dates to ISO, clamps the page, and returns pagination info', async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([row] as never);
    vi.mocked(prisma.post.count).mockResolvedValue(1 as never);

    const result = await listPublishedPosts(0, 500);

    expect(result.page).toBe(1); // clamped up
    expect(result.pageSize).toBe(100); // clamped to MAX_PAGE_SIZE
    expect(result.total).toBe(1);
    expect(result.items[0]?.publishedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(result.items[0]?.category).toEqual({ slug: 'news', name: 'News' });
  });

  it('serves a cached page without hitting the database', async () => {
    const cached = { items: [], total: 0, page: 1, pageSize: 20 };
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cached));

    const result = await listPublishedPosts(1, 20);

    expect(result).toEqual(cached);
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });
});

describe('getPostBySlug', () => {
  it('returns null when the post is missing', async () => {
    vi.mocked(prisma.post.findFirst).mockResolvedValue(null as never);
    expect(await getPostBySlug('missing')).toBeNull();
  });

  it('returns the detail with the body and ISO date', async () => {
    vi.mocked(prisma.post.findFirst).mockResolvedValue({ ...row, body: 'Full body' } as never);
    const result = await getPostBySlug('hello');
    expect(result?.body).toBe('Full body');
    expect(result?.publishedAt).toBe('2026-01-02T00:00:00.000Z');
  });
});
