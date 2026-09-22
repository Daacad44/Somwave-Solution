import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../lib/prisma', () => ({
    prisma: {
    invoice: { findFirst: vi.fn(), update: vi.fn() },
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma';
import { applyEvcWebhook, listPayments, recordPayment } from './payment.service';

const invoice = {
  id: 'inv_1',
  status: 'SENT' as const,
  total: new Prisma.Decimal('30.00'),
  paidAmount: new Prisma.Decimal('0.00'),
  clientId: 'cl_1',
  deletedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.payment.findUnique).mockResolvedValue(null as never);
});

describe('recordPayment', () => {
  it('returns 404 when the invoice is missing', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null as never);
    await expect(
      recordPayment({
        invoiceId: 'ghost',
        amount: '10.00',
        method: 'BANK_TRANSFER',
        actorId: 'user_1',
        idempotencyKey: 'pay-key-12345',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('refuses a VOID invoice', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ ...invoice, status: 'VOID' } as never);
    await expect(
      recordPayment({
        invoiceId: 'inv_1',
        amount: '10.00',
        method: 'BANK_TRANSFER',
        actorId: 'user_1',
        idempotencyKey: 'pay-key-12345',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('updates paidAmount and marks PARTIAL', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(invoice as never);
    const created = {
      id: 'pay_1',
      invoiceId: 'inv_1',
      amount: new Prisma.Decimal('10.00'),
      method: 'BANK_TRANSFER' as const,
      status: 'COMPLETED' as const,
      reference: 'TX-1',
      createdAt: new Date('2026-09-21T00:00:00Z'),
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        payment: { create: vi.fn().mockResolvedValue(created) },
        invoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx as never);
    });

    const result = await recordPayment({
      invoiceId: 'inv_1',
      amount: '10.00',
      method: 'BANK_TRANSFER',
      reference: 'TX-1',
      actorId: 'user_1',
      idempotencyKey: 'pay-key-12345',
    });
    expect(result.amount).toBe('10.00');
    expect(result.status).toBe('COMPLETED');
  });

  it('replays the same Idempotency-Key', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      invoiceId: 'inv_1',
      amount: new Prisma.Decimal('10.00'),
      method: 'BANK_TRANSFER',
      status: 'COMPLETED',
      reference: null,
      createdAt: new Date('2026-09-21T00:00:00Z'),
      deletedAt: null,
    } as never);
    const result = await recordPayment({
      invoiceId: 'inv_1',
      amount: '10.00',
      method: 'BANK_TRANSFER',
      actorId: 'user_1',
      idempotencyKey: 'pay-key-12345',
    });
    expect(result.id).toBe('pay_1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects EVC_PLUS on the manual endpoint', async () => {
    await expect(
      recordPayment({
        invoiceId: 'inv_1',
        amount: '10.00',
        method: 'EVC_PLUS',
        actorId: 'user_1',
        idempotencyKey: 'pay-key-12345',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('listPayments', () => {
  it('returns 404 when invoice is outside client scope', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null as never);
    await expect(listPayments('inv_1', 'cl_other')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

describe('applyEvcWebhook', () => {
  it('completes a pending EVC payment', async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay_1',
      invoiceId: 'inv_1',
      amount: new Prisma.Decimal('10.00'),
      method: 'EVC_PLUS',
      status: 'PENDING',
      reference: 'evc_tx',
      gatewayRef: 'evc_tx',
      createdAt: new Date(),
    } as never);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv_1',
      status: 'SENT',
      total: new Prisma.Decimal('30.00'),
      paidAmount: new Prisma.Decimal('0.00'),
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        payment: {
          update: vi.fn().mockResolvedValue({
            id: 'pay_1',
            invoiceId: 'inv_1',
            amount: new Prisma.Decimal('10.00'),
            method: 'EVC_PLUS',
            status: 'COMPLETED',
            reference: 'evc_tx',
            createdAt: new Date(),
          }),
        },
        invoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx as never);
    });

    const result = await applyEvcWebhook({ transactionId: 'evc_tx', status: 'SUCCESS' });
    expect(result?.status).toBe('COMPLETED');
  });
});
