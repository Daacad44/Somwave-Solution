import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({ prisma: { inquiry: { create: vi.fn() } } }));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { createInquiry } from './inquiry.service';

const input = { name: 'Cali', email: 'cali@example.com', message: 'Fariin dheer oo ansax ah.' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createInquiry', () => {
  it('creates the enquiry and records the idempotency key on a first request', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(prisma.inquiry.create).mockResolvedValue({ id: 'inq_1' } as never);

    const result = await createInquiry(input, 'key-1');

    expect(result).toEqual({ id: 'inq_1' });
    expect(prisma.inquiry.create).toHaveBeenCalledOnce();
    expect(redis.set).toHaveBeenCalledWith('idem:inquiry:key-1', 'inq_1', 'EX', 60 * 60 * 24);
  });

  it('returns the existing enquiry for a repeated key without creating again', async () => {
    vi.mocked(redis.get).mockResolvedValue('inq_1');

    const result = await createInquiry(input, 'key-1');

    expect(result).toEqual({ id: 'inq_1' });
    expect(prisma.inquiry.create).not.toHaveBeenCalled();
  });
});
