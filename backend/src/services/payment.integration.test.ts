import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { createInvoice, voidInvoice } from './invoice.service';
import { applyEvcWebhook, chargeEvcPlus, recordPayment } from './payment.service';

// This test may write only to an explicitly named disposable local database.
const database = process.env.FINANCE_TEST_DATABASE_URL;
const local =
  database &&
  /^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1):\d+\/somwave_.*_test(?:\?|$)/.test(
    database,
  ) &&
  process.env.DATABASE_URL === database;

afterAll(async () => {
  if (local) await prisma.$disconnect();
});

describe.skipIf(!local)('invoice and payment PostgreSQL concurrency', () => {
  it('allocates unique invoice numbers and prevents concurrent overpayment', async () => {
    const user = await prisma.user.create({
      data: {
        email: `payment-${randomUUID()}@example.test`,
        name: 'Controlled payment test user',
        passwordHash: 'test-only-not-a-login',
      },
    });
    const client = await prisma.client.create({
      data: { companyName: `Controlled payment test ${randomUUID()}` },
    });
    const input = {
      clientId: client.id,
      issueDate: '2026-10-16',
      dueDate: '2026-12-01',
      tax: '0',
      discount: '0',
      items: [{ description: 'Controlled test', quantity: '1', unitPrice: '100.00' }],
    };
    const [first, second] = await Promise.all([createInvoice(input), createInvoice(input)]);
    expect(first.number).not.toBe(second.number);
    await prisma.invoice.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { status: 'SENT' },
    });
    const charges = await Promise.allSettled([
      recordPayment({
        invoiceId: first.id,
        amount: '70.00',
        method: 'MANUAL',
        actorId: user.id,
        idempotencyKey: randomUUID(),
      }),
      recordPayment({
        invoiceId: first.id,
        amount: '70.00',
        method: 'MANUAL',
        actorId: user.id,
        idempotencyKey: randomUUID(),
      }),
    ]);
    expect(charges.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(charges.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const settled = await prisma.invoice.findUniqueOrThrow({ where: { id: first.id } });
    expect(settled.paidAmount.toFixed(2)).toBe('70.00');
    expect(settled.status).toBe('PARTIAL');
    const payments = await prisma.payment.findMany({ where: { invoiceId: first.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]?.amount.toFixed(2)).toBe('70.00');
    await expect(voidInvoice(first.id)).rejects.toMatchObject({ code: 'CONFLICT' });

    const gatewayRef = `evc-${randomUUID()}`;
    await prisma.payment.create({
      data: {
        invoiceId: second.id,
        amount: '40.00',
        method: 'EVC_PLUS',
        status: 'PENDING',
        gatewayRef,
        idempotencyKey: randomUUID(),
      },
    });
    await expect(voidInvoice(second.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    const callbacks = await Promise.all([
      applyEvcWebhook({ transactionId: gatewayRef, status: 'SUCCESS' }),
      applyEvcWebhook({ transactionId: gatewayRef, status: 'SUCCESS' }),
    ]);
    expect(callbacks.map((result) => result?.status)).toEqual(['COMPLETED', 'COMPLETED']);
    const evcInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: second.id } });
    expect(evcInvoice.paidAmount.toFixed(2)).toBe('40.00');
    // Exactly one callback claimed the PENDING payment, so exactly one credit was audited.
    const evcPayment = await prisma.payment.findFirstOrThrow({ where: { gatewayRef } });
    const evcAudits = await prisma.auditLog.findMany({
      where: { action: 'payment.evc.completed', subjectId: evcPayment.id },
    });
    expect(evcAudits).toHaveLength(1);
    const replay = await applyEvcWebhook({ transactionId: gatewayRef, status: 'SUCCESS' });
    expect(replay?.status).toBe('COMPLETED');
    const afterReplay = await prisma.invoice.findUniqueOrThrow({ where: { id: second.id } });
    expect(afterReplay.paidAmount.toFixed(2)).toBe('40.00');

    const reservedInvoice = await createInvoice(input);
    await prisma.invoice.update({ where: { id: reservedInvoice.id }, data: { status: 'SENT' } });
    await prisma.payment.create({
      data: {
        invoiceId: reservedInvoice.id,
        amount: '80.00',
        method: 'EVC_PLUS',
        status: 'PENDING',
        gatewayRef: `evc-${randomUUID()}`,
        idempotencyKey: randomUUID(),
      },
    });
    await expect(
      recordPayment({
        invoiceId: reservedInvoice.id,
        amount: '30.00',
        method: 'MANUAL',
        actorId: user.id,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      chargeEvcPlus({
        invoiceId: reservedInvoice.id,
        amount: '30.00',
        phone: '614696302',
        actorId: user.id,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
