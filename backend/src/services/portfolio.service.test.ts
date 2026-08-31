import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    portfolioItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import {
  listPublishedPortfolio,
  getPortfolioBySlug,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
} from './portfolio.service';

const item = {
  id: 'p1',
  slug: 'web',
  title: 'Web',
  summary: 'Sites',
  client: 'Acme',
  coverImage: null,
  order: 1,
};

const adminItem = {
  ...item,
  description: null,
  isPublished: true,
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listPublishedPortfolio', () => {
  it('serves the cached list without hitting the database', async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify([item]));
    const result = await listPublishedPortfolio();
    expect(result).toEqual([item]);
    expect(prisma.portfolioItem.findMany).not.toHaveBeenCalled();
  });

  it('reads published items ordered, then caches them', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(prisma.portfolioItem.findMany).mockResolvedValue([item] as never);
    const result = await listPublishedPortfolio();
    expect(result).toEqual([item]);
    expect(prisma.portfolioItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true }, orderBy: { order: 'asc' } }),
    );
    expect(redis.set).toHaveBeenCalled();
  });
});

describe('getPortfolioBySlug', () => {
  it('queries a published item by slug', async () => {
    vi.mocked(prisma.portfolioItem.findFirst).mockResolvedValue(item as never);
    const result = await getPortfolioBySlug('web');
    expect(result).toEqual(item);
    expect(prisma.portfolioItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'web', isPublished: true } }),
    );
  });
});

const createInput = {
  slug: 'web',
  title: 'Web',
  summary: 'Sites',
  order: 1,
  isPublished: true,
};

describe('createPortfolioItem', () => {
  it('creates an item, stamps publishedAt, and invalidates the cache', async () => {
    vi.mocked(prisma.portfolioItem.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.portfolioItem.create).mockResolvedValue(adminItem as never);

    const result = await createPortfolioItem(createInput);

    expect(result.slug).toBe('web');
    const arg = vi.mocked(prisma.portfolioItem.create).mock.calls[0]?.[0] as {
      data: { publishedAt: Date | null };
    };
    expect(arg.data.publishedAt).toBeInstanceOf(Date);
    expect(redis.del).toHaveBeenCalledWith('public:portfolio');
  });

  it('rejects a duplicate slug with CONFLICT', async () => {
    vi.mocked(prisma.portfolioItem.findUnique).mockResolvedValue({ id: 'existing' } as never);

    await expect(createPortfolioItem(createInput)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.portfolioItem.create).not.toHaveBeenCalled();
  });
});

describe('updatePortfolioItem', () => {
  it('throws NOT_FOUND when the item is missing', async () => {
    vi.mocked(prisma.portfolioItem.findUnique).mockResolvedValue(null as never);
    await expect(updatePortfolioItem('missing', { title: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a slug that collides with another item', async () => {
    vi.mocked(prisma.portfolioItem.findUnique)
      .mockResolvedValueOnce({ id: 'p1', slug: 'web', isPublished: true } as never)
      .mockResolvedValueOnce({ id: 'other' } as never);

    await expect(updatePortfolioItem('p1', { slug: 'taken' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.portfolioItem.update).not.toHaveBeenCalled();
  });
});

describe('deletePortfolioItem', () => {
  it('deletes an existing item and invalidates the cache', async () => {
    vi.mocked(prisma.portfolioItem.findUnique).mockResolvedValue({ id: 'p1' } as never);
    vi.mocked(prisma.portfolioItem.delete).mockResolvedValue({} as never);

    await deletePortfolioItem('p1');

    expect(prisma.portfolioItem.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(redis.del).toHaveBeenCalledWith('public:portfolio');
  });
});
