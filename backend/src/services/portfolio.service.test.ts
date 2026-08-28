import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: { portfolioItem: { findMany: vi.fn(), findFirst: vi.fn() } },
}));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { listPublishedPortfolio, getPortfolioBySlug } from './portfolio.service';

const item = {
  id: 'p1',
  slug: 'web',
  title: 'Web',
  summary: 'Sites',
  client: 'Acme',
  coverImage: null,
  order: 1,
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
