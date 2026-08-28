import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    service: {
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
  listPublishedServices,
  createService,
  updateService,
  deleteService,
} from './service.service';

const rows = [{ id: 's1', slug: 'web', title: 'Web', summary: 'Sites', order: 1 }];

const adminRow = {
  id: 's1',
  slug: 'web',
  title: 'Web',
  summary: 'Sites',
  description: null,
  icon: null,
  order: 1,
  isPublished: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

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

describe('createService', () => {
  it('creates a service and invalidates the public cache', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.service.create).mockResolvedValue(adminRow as never);

    const result = await createService({
      slug: 'web',
      title: 'Web',
      summary: 'Sites',
      order: 1,
      isPublished: true,
    });

    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(redis.del).toHaveBeenCalledWith('public:services');
  });

  it('rejects a duplicate slug with CONFLICT', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ id: 'existing' } as never);

    await expect(
      createService({ slug: 'web', title: 'Web', summary: 'Sites', order: 0, isPublished: true }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.service.create).not.toHaveBeenCalled();
  });
});

describe('updateService', () => {
  it('throws NOT_FOUND when the service is missing', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null as never);
    await expect(updateService('missing', { title: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a slug that collides with another service', async () => {
    vi.mocked(prisma.service.findUnique)
      .mockResolvedValueOnce({ id: 's1', slug: 'web' } as never) // the target
      .mockResolvedValueOnce({ id: 'other' } as never); // the clash

    await expect(updateService('s1', { slug: 'taken' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.service.update).not.toHaveBeenCalled();
  });
});

describe('deleteService', () => {
  it('deletes an existing service and invalidates the cache', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ id: 's1' } as never);
    vi.mocked(prisma.service.delete).mockResolvedValue({} as never);

    await deleteService('s1');

    expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(redis.del).toHaveBeenCalledWith('public:services');
  });
});
