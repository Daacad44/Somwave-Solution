import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: { jobOpening: { findFirst: vi.fn() }, jobApplication: { create: vi.fn() } },
}));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { applyToOpening } from './job.service';
import { AppError } from '../lib/http';

const input = { name: 'Cali', email: 'cali@example.com' };

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
