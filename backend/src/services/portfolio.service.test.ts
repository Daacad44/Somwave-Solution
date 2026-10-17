import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    portfolioItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));
vi.mock('./articleImage.service', () => ({ releaseRemovedImages: vi.fn() }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { releaseRemovedImages } from './articleImage.service';
import {
  listPublishedPortfolio,
  getPortfolioBySlug,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  recordPortfolioDemoClick,
} from './portfolio.service';

const item = {
  id: 'p1',
  slug: 'web',
  title: 'Web',
  summary: 'Sites',
  client: 'Acme',
  category: 'WEBSITE',
  coverImage: null,
  order: 1,
  featured: false,
};

const adminItem = {
  ...item,
  description: null,
  technologies: [],
  galleryImages: [],
  features: [],
  completionDate: null,
  projectStatus: null,
  liveDemoUrl: null,
  caseStudyUrl: null,
  isArchived: false,
  seoTitle: null,
  seoDescription: null,
  demoClicks: 0,
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
      expect.objectContaining({
        where: { isPublished: true, isArchived: false },
        orderBy: [{ featured: 'desc' }, { order: 'asc' }],
      }),
    );
    expect(redis.set).toHaveBeenCalled();
  });
});

describe('getPortfolioBySlug', () => {
  it('queries a published item by slug', async () => {
    vi.mocked(prisma.portfolioItem.findFirst).mockResolvedValue({
      ...adminItem,
      completionDate: null,
    } as never);
    const result = await getPortfolioBySlug('web');
    expect(result).toEqual(expect.objectContaining({ ...item, completionDate: null }));
    expect(prisma.portfolioItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'web', isPublished: true, isArchived: false } }),
    );
  });
});

const createInput = {
  slug: 'web',
  title: 'Web',
  summary: 'Sites',
  category: 'WEBSITE' as const,
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
      data: { publishedAt: Date | null; category: string | null };
    };
    expect(arg.data.publishedAt).toBeInstanceOf(Date);
    expect(arg.data.category).toBe('WEBSITE');
    expect(redis.del).toHaveBeenCalledWith('public:portfolio:v3');
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
  it('deletes an existing item, invalidates the cache and releases its images', async () => {
    vi.mocked(prisma.portfolioItem.findUnique).mockResolvedValue({
      id: 'p1',
      coverImage: 'https://cdn/cover.jpg',
      galleryImages: ['https://cdn/g1.jpg'],
    } as never);
    vi.mocked(prisma.portfolioItem.delete).mockResolvedValue({} as never);

    await deletePortfolioItem('p1');

    expect(prisma.portfolioItem.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(redis.del).toHaveBeenCalledWith('public:portfolio:v3');
    expect(releaseRemovedImages).toHaveBeenCalledWith(
      ['https://cdn/cover.jpg', 'https://cdn/g1.jpg'],
      [],
    );
  });
});

describe('recordPortfolioDemoClick', () => {
  it('increments an aggregate only for a published item with a live demo', async () => {
    vi.mocked(prisma.portfolioItem.updateMany).mockResolvedValue({ count: 1 } as never);
    await expect(recordPortfolioDemoClick('p1')).resolves.toEqual({ recorded: true });
    expect(prisma.portfolioItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', isPublished: true, isArchived: false, liveDemoUrl: { not: null } },
      data: { demoClicks: { increment: 1 } },
    });
  });

  it('does not record an unavailable demo', async () => {
    vi.mocked(prisma.portfolioItem.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(recordPortfolioDemoClick('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
