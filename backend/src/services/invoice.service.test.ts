import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../lib/prisma', () => ({
  prisma: {
    client: { findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  sendInvoice,
  voidInvoice,
} from './invoice.service';

const created = {
  id: 'inv_1',
  number: 'INV-2026-0001',
  status: 'DRAFT' as const,
  issueDate: new Date('2026-09-01T00:00:00Z'),
  dueDate: new Date('2026-12-15T00:00:00Z'),
  subtotal: new Prisma.Decimal('30.00'),
  tax: new Prisma.Decimal('0.00'),
  discount: new Prisma.Decimal('0.00'),
  total: new Prisma.Decimal('30.00'),
  paidAmount: new Prisma.Decimal('0.00'),
  createdAt: new Date('2026-09-01T00:00:00Z'),
  client: { id: 'cl_1', companyName: 'Acme' },
  project: null,
  items: [
    {
      id: 'item_1',
      description: 'Web',
      quantity: new Prisma.Decimal('2.00'),
      unitPrice: new Prisma.Decimal('15.00'),
      lineTotal: new Prisma.Decimal('30.00'),
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.invoice.updateMany).mockResolvedValue({ count: 0 } as never);
});

describe('listInvoices', () => {
  it('scopes to a client when clientId is provided', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([created] as never);
    await listInvoices('cl_1');
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, clientId: 'cl_1' } }),
    );
  });

  it('marks SENT invoices past due as OVERDUE', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        ...created,
        status: 'SENT',
        dueDate: new Date('2020-01-01T00:00:00Z'),
      },
    ] as never);
    const rows = await listInvoices();
    expect(rows[0]?.status).toBe('OVERDUE');
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SENT' }),
        data: { status: 'OVERDUE' },
      }),
    );
  });
});

describe('getInvoice', () => {
  it('returns 404 when another client asks for the row', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null as never);
    await expect(getInvoice('inv_1', 'cl_other')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv_1', deletedAt: null, clientId: 'cl_other' },
      }),
    );
  });

  it('returns the invoice with line items', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(created as never);
    const row = await getInvoice('inv_1');
    expect(row.items).toHaveLength(1);
    expect(row.items[0]?.lineTotal).toBe('30.00');
    expect(row.tax).toBe('0.00');
  });
});

describe('createInvoice', () => {
  it('computes line totals, tax, and discount on the server', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: 'cl_1' } as never);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.create).mockResolvedValue({
      ...created,
      tax: new Prisma.Decimal('3.00'),
      discount: new Prisma.Decimal('1.00'),
      total: new Prisma.Decimal('32.00'),
    } as never);

    const result = await createInvoice({
      clientId: 'cl_1',
      issueDate: '2026-09-01',
      dueDate: '2026-12-15',
      tax: '3.00',
      discount: '1.00',
      items: [{ description: 'Web', quantity: '2', unitPrice: '15.00' }],
    });

    expect(result.total).toBe('32.00');
    const payload = vi.mocked(prisma.invoice.create).mock.calls[0]?.[0];
    expect(payload?.data.subtotal.toString()).toBe('30');
    expect(payload?.data.tax?.toString()).toBe('3');
    expect(payload?.data.discount?.toString()).toBe('1');
    expect(payload?.data.total.toString()).toBe('32');
  });

  it('rejects an unknown client', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null as never);
    await expect(
      createInvoice({
        clientId: 'ghost',
        issueDate: '2026-09-01',
        dueDate: '2026-12-15',
        tax: '0',
        discount: '0',
        items: [{ description: 'Web', quantity: '1', unitPrice: '10' }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('rejects a discount larger than subtotal plus tax', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: 'cl_1' } as never);
    await expect(
      createInvoice({
        clientId: 'cl_1',
        issueDate: '2026-09-01',
        dueDate: '2026-12-15',
        tax: '0',
        discount: '50.00',
        items: [{ description: 'Web', quantity: '1', unitPrice: '10' }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });
});

describe('sendInvoice', () => {
  it('moves DRAFT to SENT', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(created as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({ ...created, status: 'SENT' } as never);
    const result = await sendInvoice('inv_1');
    expect(result.status).toBe('SENT');
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SENT' } }),
    );
  });

  it('marks a past-due DRAFT as OVERDUE when sent', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      ...created,
      dueDate: new Date('2020-01-01T00:00:00Z'),
    } as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({
      ...created,
      dueDate: new Date('2020-01-01T00:00:00Z'),
      status: 'OVERDUE',
    } as never);
    const result = await sendInvoice('inv_1');
    expect(result.status).toBe('OVERDUE');
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'OVERDUE' } }),
    );
  });

  it('is idempotent when already SENT', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ ...created, status: 'SENT' } as never);
    const result = await sendInvoice('inv_1');
    expect(result.status).toBe('SENT');
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('returns 404 for another client', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null as never);
    await expect(sendInvoice('inv_1', 'cl_other')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('refuses VOID invoices', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ ...created, status: 'VOID' } as never);
    await expect(sendInvoice('inv_1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('voidInvoice', () => {
  it('voids a DRAFT invoice', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(created as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({ ...created, status: 'VOID' } as never);
    const result = await voidInvoice('inv_1');
    expect(result.status).toBe('VOID');
  });

  it('refuses a PAID invoice', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ ...created, status: 'PAID' } as never);
    await expect(voidInvoice('inv_1')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('returns 404 for another client', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null as never);
    await expect(voidInvoice('inv_1', 'cl_other')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});
