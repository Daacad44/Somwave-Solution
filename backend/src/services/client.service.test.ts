import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    client: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { listClients, createClient, updateClient } from './client.service';

const row = {
  id: 'cl_1',
  companyName: 'Acme',
  email: 'ops@acme.test',
  phone: null,
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listClients', () => {
  it('returns ISO createdAt', async () => {
    vi.mocked(prisma.client.findMany).mockResolvedValue([row] as never);
    const result = await listClients();
    expect(result[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result[0]?.companyName).toBe('Acme');
  });
});

describe('createClient', () => {
  it('creates a client', async () => {
    vi.mocked(prisma.client.create).mockResolvedValue(row as never);
    const result = await createClient({ companyName: 'Acme', status: 'ACTIVE' });
    expect(result.id).toBe('cl_1');
    expect(prisma.client.create).toHaveBeenCalledOnce();
  });
});

describe('updateClient', () => {
  it('throws NOT_FOUND when the client is missing', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null as never);
    await expect(updateClient('missing', { companyName: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
