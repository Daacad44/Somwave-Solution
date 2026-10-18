import type { PaymentGateway, PaymentGatewayChargeInput } from '@somwave/shared';
import { AppError } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { initiateEvcCharge } from '../evcplus.client';
import {
  assertPaymentReplay,
  assertAmountWithinBalance,
  loadPayableInvoice,
  parseChargeAmount,
  toPaymentRecord,
} from '../paymentCore';

export type ScopedChargeInput = PaymentGatewayChargeInput & { clientId?: string | null };

export class EvcPlusGateway implements PaymentGateway {
  async charge(input: ScopedChargeInput) {
    const scoped = input as ScopedChargeInput;
    const amount = parseChargeAmount(input.amount);
    if (!input.payerPhone) {
      throw new AppError('VALIDATION_ERROR', 400, 'EVC number is required');
    }

    // Check the invoice owner before returning a replayed payment to a portal user.
    const invoice = await loadPayableInvoice(
      (where) =>
        prisma.invoice.findFirst({
          where,
          select: {
            id: true,
            status: true,
            total: true,
            paidAmount: true,
            clientId: true,
          },
        }),
      input.invoiceId,
      scoped.clientId,
    );
    const existingKey = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existingKey && existingKey.deletedAt === null) {
      assertPaymentReplay(existingKey, { ...input, amount });
      return toPaymentRecord(existingKey);
    }
    assertAmountWithinBalance(invoice, amount);

    const pending = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${input.invoiceId} FOR UPDATE`;
      const current = await loadPayableInvoice(
        (where) =>
          tx.invoice.findFirst({
            where,
            select: { id: true, status: true, total: true, paidAmount: true, clientId: true },
          }),
        input.invoiceId,
        scoped.clientId,
      );
      const reserved = await tx.payment.aggregate({
        where: { invoiceId: current.id, status: 'PENDING', deletedAt: null },
        _sum: { amount: true },
      });
      assertAmountWithinBalance(current, amount, reserved._sum.amount);
      return tx.payment.create({
        data: {
          invoiceId: current.id,
          amount,
          method: 'EVC_PLUS',
          status: 'PENDING',
          payerPhone: input.payerPhone,
          recordedById: input.actorId,
          idempotencyKey: input.idempotencyKey,
        },
      });
    });

    let transactionId: string;
    try {
      ({ transactionId } = await initiateEvcCharge({
        amount: amount.toFixed(2),
        phone: input.payerPhone,
        merchantReference: pending.id,
      }));
    } catch (error) {
      // PAYMENT_FAILED means the provider refused (or is not configured): nothing
      // was charged, so release the reserved amount. Network errors and timeouts
      // are ambiguous and stay PENDING until the provider webhook settles them.
      if (error instanceof AppError && error.code === 'PAYMENT_FAILED') {
        await prisma.payment.update({ where: { id: pending.id }, data: { status: 'FAILED' } });
      }
      throw error;
    }

    const updated = await prisma.payment.update({
      where: { id: pending.id },
      data: {
        gatewayRef: transactionId,
        reference: transactionId,
      },
    });

    return toPaymentRecord(updated);
  }
}
