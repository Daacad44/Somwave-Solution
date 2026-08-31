import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    subscriber: { upsert: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { subscribe, listSubscribers, deleteSubscriber } from './subscriber.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscribe', () => {
  it('upserts a normalised (lowercased, trimmed) email so repeats never duplicate', async () => {
    vi.mocked(prisma.subscriber.upsert).mockResolvedValue({ id: 'sub_1' } as never);

    const result = await subscribe({ email: '  Cali@Example.COM ' });

    expect(result).toEqual({ id: 'sub_1' });
    expect(prisma.subscriber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'cali@example.com' } }),
    );
  });
});

describe('listSubscribers', () => {
  it('maps rows to the admin shape (ISO createdAt)', async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([
      {
        id: 'sub_1',
        email: 'cali@example.com',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ] as never);

    const result = await listSubscribers();

    expect(result[0]).toEqual({
      id: 'sub_1',
      email: 'cali@example.com',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('deleteSubscriber', () => {
  it('throws NOT_FOUND when the subscriber is missing', async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null as never);
    await expect(deleteSubscriber('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deletes an existing subscriber', async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({ id: 'sub_1' } as never);
    vi.mocked(prisma.subscriber.delete).mockResolvedValue({} as never);

    await deleteSubscriber('sub_1');

    expect(prisma.subscriber.delete).toHaveBeenCalledWith({ where: { id: 'sub_1' } });
  });
});
