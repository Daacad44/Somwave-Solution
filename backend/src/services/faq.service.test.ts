import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    faq: {
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
import { listPublishedFaqs, createFaq, updateFaq, deleteFaq } from './faq.service';

const publicRow = { id: 'f1', question: 'How long?', answer: 'A few weeks' };
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

describe('listPublishedFaqs', () => {
  it('serves the cached list without hitting the database', async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify([publicRow]));
    const result = await listPublishedFaqs();
    expect(result).toEqual([publicRow]);
    expect(prisma.faq.findMany).not.toHaveBeenCalled();
  });

  it('reads published FAQs ordered, then caches them', async () => {
    vi.mocked(prisma.faq.findMany).mockResolvedValue([publicRow] as never);
    const result = await listPublishedFaqs();
    expect(result).toEqual([publicRow]);
    expect(prisma.faq.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true }, orderBy: { order: 'asc' } }),
    );
    expect(redis.set).toHaveBeenCalled();
  });
});

describe('createFaq', () => {
  it('creates a FAQ and invalidates the public cache', async () => {
    vi.mocked(prisma.faq.create).mockResolvedValue(adminRow as never);

    const result = await createFaq({
      question: 'How long?',
      answer: 'A few weeks',
      order: 1,
      isPublished: true,
    });

    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(redis.del).toHaveBeenCalledWith('public:faqs');
  });
});

describe('updateFaq', () => {
  it('throws NOT_FOUND when the FAQ is missing', async () => {
    vi.mocked(prisma.faq.findUnique).mockResolvedValue(null as never);
    await expect(updateFaq('missing', { question: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('deleteFaq', () => {
  it('deletes an existing FAQ and invalidates the cache', async () => {
    vi.mocked(prisma.faq.findUnique).mockResolvedValue({ id: 'f1' } as never);
    vi.mocked(prisma.faq.delete).mockResolvedValue({} as never);

    await deleteFaq('f1');

    expect(prisma.faq.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
    expect(redis.del).toHaveBeenCalledWith('public:faqs');
  });
});
