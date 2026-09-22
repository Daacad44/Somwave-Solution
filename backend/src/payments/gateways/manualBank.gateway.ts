import type { PaymentGateway, PaymentGatewayChargeInput } from '@somwave/shared';
import { prisma } from '../../lib/prisma';
import {
  assertAmountWithinBalance,
  loadPayableInvoice,
  nextInvoiceStatus,
  parseChargeAmount,
  toPaymentRecord,
} from '../paymentCore';

export type ScopedChargeInput = PaymentGatewayChargeInput & { clientId?: string | null };

export class ManualBankTransferGateway implements PaymentGateway {
  async charge(input: ScopedChargeInput) {
    const existingKey = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existingKey && existingKey.deletedAt === null) {
      return toPaymentRecord(existingKey);
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
      input.clientId,
    );

    const amount = parseChargeAmount(input.amount);
    assertAmountWithinBalance(invoice, amount);
    const nextPaid = invoice.paidAmount.add(amount);

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method: input.method,
          status: 'COMPLETED',
          reference: input.reference ?? null,
          recordedById: input.actorId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: nextPaid,
          status: nextInvoiceStatus(invoice.status, nextPaid, invoice.total),
        },
      });
      return created;
    });

    return toPaymentRecord(payment);
  }
}
