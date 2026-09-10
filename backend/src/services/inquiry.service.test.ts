import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    inquiry: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { createInquiry, listInquiries, updateInquiryStatus } from './inquiry.service';

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

describe('listInquiries', () => {
  it('returns ISO dates for the admin inbox', async () => {
    vi.mocked(prisma.inquiry.findMany).mockResolvedValue([
      {
        id: 'inq_1',
        name: 'Cali',
        email: 'cali@example.com',
        phone: null,
        message: 'Fariin',
        status: 'NEW',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ] as never);

    const result = await listInquiries();

    expect(result[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result[0]?.status).toBe('NEW');
  });
});

describe('updateInquiryStatus', () => {
  it('throws NOT_FOUND when the enquiry is missing', async () => {
    vi.mocked(prisma.inquiry.findUnique).mockResolvedValue(null as never);
    await expect(updateInquiryStatus('missing', 'READ')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
