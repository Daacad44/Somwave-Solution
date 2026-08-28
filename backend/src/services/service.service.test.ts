import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({ prisma: { service: { findMany: vi.fn() } } }));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { listPublishedServices } from './service.service';

const rows = [{ id: 's1', slug: 'web', title: 'Web', summary: 'Sites', order: 1 }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listPublishedServices', () => {
  it('returns the cached list without hitting the database', async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(rows));

    const result = await listPublishedServices();

    expect(result).toEqual(rows);
    expect(prisma.service.findMany).not.toHaveBeenCalled();
  });

  it('reads published services from the database and caches them on a miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(prisma.service.findMany).mockResolvedValue(rows as never);

    const result = await listPublishedServices();

    expect(result).toEqual(rows);
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true }, orderBy: { order: 'asc' } }),
    );
    expect(redis.set).toHaveBeenCalledWith('public:services', JSON.stringify(rows), 'EX', 300);
  });

  it('falls through to the database when the cache read throws', async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error('redis down'));
    vi.mocked(prisma.service.findMany).mockResolvedValue(rows as never);

    const result = await listPublishedServices();

    expect(result).toEqual(rows);
  });
});
