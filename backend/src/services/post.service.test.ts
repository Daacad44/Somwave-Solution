import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock('../lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn(), scan: vi.fn(), del: vi.fn() },
}));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import {
  listPublishedPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
} from './post.service';

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

const adminRow = {
  id: 'p1',
  slug: 'hello',
  title: 'Hello',
  excerpt: 'Intro',
  body: 'Full body',
  coverImage: null,
  isPublished: false,
  publishedAt: null,
  categoryId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  category: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.get).mockResolvedValue(null);
  vi.mocked(redis.scan).mockResolvedValue(['0', []] as never);
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

const createInput = {
  slug: 'hello',
  title: 'Hello',
  excerpt: 'Intro',
  body: 'Full body',
  isPublished: false,
};

describe('createPost', () => {
  it('creates a post and invalidates the public cache', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.post.create).mockResolvedValue(adminRow as never);

    const result = await createPost(createInput);

    expect(result.slug).toBe('hello');
    expect(redis.scan).toHaveBeenCalled();
  });

  it('sets publishedAt when created as published', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.post.create).mockResolvedValue(adminRow as never);

    await createPost({ ...createInput, isPublished: true });

    const arg = vi.mocked(prisma.post.create).mock.calls[0]?.[0] as {
      data: { publishedAt: Date | null };
    };
    expect(arg.data.publishedAt).toBeInstanceOf(Date);
  });

  it('rejects a duplicate slug with CONFLICT', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({ id: 'existing' } as never);

    await expect(createPost(createInput)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.post.create).not.toHaveBeenCalled();
  });
});

describe('updatePost', () => {
  it('throws NOT_FOUND when the post is missing', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(null as never);
    await expect(updatePost('missing', { title: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('stamps publishedAt the first time a post is published', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({
      id: 'p1',
      slug: 'hello',
      isPublished: false,
      publishedAt: null,
    } as never);
    vi.mocked(prisma.post.update).mockResolvedValue(adminRow as never);

    await updatePost('p1', { isPublished: true });

    const arg = vi.mocked(prisma.post.update).mock.calls[0]?.[0] as {
      data: { publishedAt?: Date };
    };
    expect(arg.data.publishedAt).toBeInstanceOf(Date);
  });
});

describe('deletePost', () => {
  it('deletes an existing post and invalidates the cache', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({ id: 'p1' } as never);
    vi.mocked(prisma.post.delete).mockResolvedValue({} as never);

    await deletePost('p1');

    expect(prisma.post.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(redis.scan).toHaveBeenCalled();
  });
});
