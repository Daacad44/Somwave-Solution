import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../lib/prisma', () => ({
  prisma: {
    client: { findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
    invoice: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { listInvoices, createInvoice } from './invoice.service';

const created = {
  id: 'inv_1',
  number: 'INV-2026-0001',
  status: 'DRAFT' as const,
  issueDate: new Date('2026-09-01T00:00:00Z'),
  dueDate: new Date('2026-09-15T00:00:00Z'),
  total: new Prisma.Decimal('30.00'),
  paidAmount: new Prisma.Decimal('0.00'),
  createdAt: new Date('2026-09-01T00:00:00Z'),
  client: { id: 'cl_1', companyName: 'Acme' },
  project: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listInvoices', () => {
  it('scopes to a client when clientId is provided', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([created] as never);
    await listInvoices('cl_1');
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, clientId: 'cl_1' } }),
    );
  });
});

describe('createInvoice', () => {
  it('computes line totals on the server', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: 'cl_1' } as never);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.create).mockResolvedValue(created as never);

    const result = await createInvoice({
      clientId: 'cl_1',
      issueDate: '2026-09-01',
      dueDate: '2026-09-15',
      items: [{ description: 'Web', quantity: '2', unitPrice: '15.00' }],
    });

    expect(result.total).toBe('30.00');
    const payload = vi.mocked(prisma.invoice.create).mock.calls[0]?.[0];
    expect(payload?.data.total.toString()).toBe('30');
  });

  it('rejects an unknown client', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null as never);
    await expect(
      createInvoice({
        clientId: 'ghost',
        issueDate: '2026-09-01',
        dueDate: '2026-09-15',
        items: [{ description: 'Web', quantity: '1', unitPrice: '10' }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });
});
