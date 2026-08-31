import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    jobOpening: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    jobApplication: { create: vi.fn() },
  },
}));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { applyToOpening, createOpening, updateOpening, deleteOpening } from './job.service';
import { AppError } from '../lib/http';

const input = { name: 'Cali', email: 'cali@example.com' };

const openingInput = {
  slug: 'frontend',
  title: 'Frontend',
  location: 'Muqdisho',
  employmentType: 'FULL_TIME' as const,
  summary: 'Ku biir',
  description: 'Faahfaahin',
  isPublished: true,
};

const adminRow = {
  id: 'job_1',
  slug: 'frontend',
  title: 'Frontend',
  location: 'Muqdisho',
  employmentType: 'FULL_TIME' as const,
  summary: 'Ku biir',
  description: 'Faahfaahin',
  isPublished: true,
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  _count: { applications: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyToOpening', () => {
  it('creates the application and records the idempotency key on a first request', async () => {
    vi.mocked(prisma.jobOpening.findFirst).mockResolvedValue({ id: 'job_1' } as never);
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(prisma.jobApplication.create).mockResolvedValue({ id: 'app_1' } as never);

    const result = await applyToOpening('horumariye-frontend', input, 'key-1');

    expect(result).toEqual({ id: 'app_1' });
    expect(prisma.jobApplication.create).toHaveBeenCalledOnce();
    expect(redis.set).toHaveBeenCalledWith('idem:application:key-1', 'app_1', 'EX', 60 * 60 * 24);
  });

  it('returns the existing application for a repeated key without creating again', async () => {
    vi.mocked(prisma.jobOpening.findFirst).mockResolvedValue({ id: 'job_1' } as never);
    vi.mocked(redis.get).mockResolvedValue('app_1');

    const result = await applyToOpening('horumariye-frontend', input, 'key-1');

    expect(result).toEqual({ id: 'app_1' });
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when the opening does not exist or is unpublished', async () => {
    vi.mocked(prisma.jobOpening.findFirst).mockResolvedValue(null);

    await expect(applyToOpening('ma-jiro', input, 'key-1')).rejects.toBeInstanceOf(AppError);
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });
});

describe('createOpening', () => {
  it('creates an opening, stamps publishedAt, and invalidates the cache', async () => {
    vi.mocked(prisma.jobOpening.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.jobOpening.create).mockResolvedValue(adminRow as never);

    const result = await createOpening(openingInput);

    expect(result).toMatchObject({ slug: 'frontend', applicationCount: 0 });
    const arg = vi.mocked(prisma.jobOpening.create).mock.calls[0]?.[0] as {
      data: { publishedAt: Date | null };
    };
    expect(arg.data.publishedAt).toBeInstanceOf(Date);
    expect(redis.del).toHaveBeenCalledWith('public:careers');
  });

  it('rejects a duplicate slug with CONFLICT', async () => {
    vi.mocked(prisma.jobOpening.findUnique).mockResolvedValue({ id: 'existing' } as never);

    await expect(createOpening(openingInput)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.jobOpening.create).not.toHaveBeenCalled();
  });
});

describe('updateOpening', () => {
  it('throws NOT_FOUND when the opening is missing', async () => {
    vi.mocked(prisma.jobOpening.findUnique).mockResolvedValue(null as never);
    await expect(updateOpening('missing', { title: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('deleteOpening', () => {
  it('refuses to delete an opening that has applications', async () => {
    vi.mocked(prisma.jobOpening.findUnique).mockResolvedValue({
      id: 'job_1',
      _count: { applications: 3 },
    } as never);

    await expect(deleteOpening('job_1')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.jobOpening.delete).not.toHaveBeenCalled();
  });

  it('deletes an opening with no applications and invalidates the cache', async () => {
    vi.mocked(prisma.jobOpening.findUnique).mockResolvedValue({
      id: 'job_1',
      _count: { applications: 0 },
    } as never);
    vi.mocked(prisma.jobOpening.delete).mockResolvedValue({} as never);

    await deleteOpening('job_1');

    expect(prisma.jobOpening.delete).toHaveBeenCalledWith({ where: { id: 'job_1' } });
    expect(redis.del).toHaveBeenCalledWith('public:careers');
  });
});
