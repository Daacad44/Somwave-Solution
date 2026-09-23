import type { PaymentGateway, PaymentGatewayChargeInput } from '@somwave/shared';
import { AppError } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { initiateEvcCharge } from '../evcplus.client';
import {
  assertAmountWithinBalance,
  loadPayableInvoice,
  parseChargeAmount,
  toPaymentRecord,
} from '../paymentCore';

export type ScopedChargeInput = PaymentGatewayChargeInput & { clientId?: string | null };

export class EvcPlusGateway implements PaymentGateway {
  async charge(input: ScopedChargeInput) {
    const scoped = input as ScopedChargeInput;
    const existingKey = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existingKey && existingKey.deletedAt === null) {
      return toPaymentRecord(existingKey);
    }

    if (!input.payerPhone) {
      throw new AppError('VALIDATION_ERROR', 400, 'Lambarka EVC waa waajib');
    }

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

    const amount = parseChargeAmount(input.amount);
    assertAmountWithinBalance(invoice, amount);

    const pending = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        method: 'EVC_PLUS',
        status: 'PENDING',
        payerPhone: input.payerPhone,
        recordedById: input.actorId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const { transactionId } = await initiateEvcCharge({
      amount: amount.toFixed(2),
      phone: input.payerPhone,
      merchantReference: pending.id,
    });

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
