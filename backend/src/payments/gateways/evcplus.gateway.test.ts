import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const db = vi.hoisted(() => ({
  invoice: { findFirst: vi.fn() },
  payment: { findUnique: vi.fn(), aggregate: vi.fn(), create: vi.fn(), update: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({ prisma: db }));
vi.mock('../evcplus.client', () => ({ initiateEvcCharge: vi.fn() }));

import { AppError } from '../../lib/http';
import { initiateEvcCharge } from '../evcplus.client';
import { EvcPlusGateway } from './evcplus.gateway';

const invoice = {
  id: 'inv_1',
  status: 'SENT',
  total: new Prisma.Decimal('100.00'),
  paidAmount: new Prisma.Decimal('0.00'),
  clientId: 'client_1',
};

const pending = {
  id: 'pay_1',
  invoiceId: 'inv_1',
  amount: new Prisma.Decimal('40.00'),
  method: 'EVC_PLUS',
  status: 'PENDING',
  reference: null,
  gatewayRef: null,
  payerPhone: '252610000000',
  paidAt: new Date('2026-10-18T00:00:00Z'),
  idempotencyKey: 'key-1',
  recordedById: 'user_1',
  deletedAt: null,
  createdAt: new Date('2026-10-18T00:00:00Z'),
  updatedAt: new Date('2026-10-18T00:00:00Z'),
};

const input = {
  invoiceId: 'inv_1',
  amount: '40.00',
  payerPhone: '252610000000',
  idempotencyKey: 'key-1',
  actorId: 'user_1',
  clientId: 'client_1',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.invoice.findFirst.mockResolvedValue(invoice);
  db.payment.findUnique.mockResolvedValue(null);
  db.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
  db.payment.create.mockResolvedValue(pending);
  db.$transaction.mockImplementation(async (work: (tx: typeof db) => unknown) => work(db));
});

describe('EvcPlusGateway.charge', () => {
  it('records the provider transaction id on success', async () => {
    vi.mocked(initiateEvcCharge).mockResolvedValue({ transactionId: 'evc_123' });
    db.payment.update.mockResolvedValue({
      ...pending,
      gatewayRef: 'evc_123',
      reference: 'evc_123',
    });
    await new EvcPlusGateway().charge(input as never);
    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { gatewayRef: 'evc_123', reference: 'evc_123' },
    });
  });

  it('marks the reserved payment FAILED when the provider rejects the charge', async () => {
    vi.mocked(initiateEvcCharge).mockRejectedValue(
      new AppError('PAYMENT_FAILED', 502, 'EVC Plus is not configured'),
    );
    await expect(new EvcPlusGateway().charge(input as never)).rejects.toMatchObject({
      code: 'PAYMENT_FAILED',
    });
    // Without this the PENDING row kept reserving 40.00 forever and blocked the invoice.
    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { status: 'FAILED' },
    });
  });

  it('keeps the payment PENDING when the outcome is unknown (network error or timeout)', async () => {
    vi.mocked(initiateEvcCharge).mockRejectedValue(new TypeError('fetch failed'));
    await expect(new EvcPlusGateway().charge(input as never)).rejects.toThrow('fetch failed');
    expect(db.payment.update).not.toHaveBeenCalled();
  });
});
