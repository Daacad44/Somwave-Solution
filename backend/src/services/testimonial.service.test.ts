import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    testimonial: {
      findMany: vi.fn(),
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
  listPublishedTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from './testimonial.service';

const publicRow = {
  id: 't1',
  author: 'Faadumo',
  role: 'CEO',
  company: 'Acme',
  quote: 'Great work',
  avatarUrl: null,
  rating: 5,
};

const adminRow = {
  ...publicRow,
  order: 1,
  isPublished: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.get).mockResolvedValue(null);
});

describe('listPublishedTestimonials', () => {
  it('serves the cached list without hitting the database', async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify([publicRow]));
    const result = await listPublishedTestimonials();
    expect(result).toEqual([publicRow]);
    expect(prisma.testimonial.findMany).not.toHaveBeenCalled();
  });

  it('reads published testimonials ordered, then caches them', async () => {
    vi.mocked(prisma.testimonial.findMany).mockResolvedValue([publicRow] as never);
    const result = await listPublishedTestimonials();
    expect(result).toEqual([publicRow]);
    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true }, orderBy: { order: 'asc' } }),
    );
    expect(redis.set).toHaveBeenCalled();
  });
});

describe('createTestimonial', () => {
  it('creates a testimonial and invalidates the public cache', async () => {
    vi.mocked(prisma.testimonial.create).mockResolvedValue(adminRow as never);

    const result = await createTestimonial({
      author: 'Faadumo',
      quote: 'Great work',
      order: 1,
      isPublished: true,
    });

    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(redis.del).toHaveBeenCalledWith('public:testimonials');
  });
});

describe('updateTestimonial', () => {
  it('throws NOT_FOUND when the testimonial is missing', async () => {
    vi.mocked(prisma.testimonial.findUnique).mockResolvedValue(null as never);
    await expect(updateTestimonial('missing', { author: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('deleteTestimonial', () => {
  it('deletes an existing testimonial and invalidates the cache', async () => {
    vi.mocked(prisma.testimonial.findUnique).mockResolvedValue({ id: 't1' } as never);
    vi.mocked(prisma.testimonial.delete).mockResolvedValue({} as never);

    await deleteTestimonial('t1');

    expect(prisma.testimonial.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(redis.del).toHaveBeenCalledWith('public:testimonials');
  });
});
