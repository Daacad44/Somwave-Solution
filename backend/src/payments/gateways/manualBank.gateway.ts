import type { PaymentGateway, PaymentGatewayChargeInput } from '@somwave/shared';
import { prisma } from '../../lib/prisma';
import {
  assertPaymentReplay,
  assertAmountWithinBalance,
  loadPayableInvoice,
  nextInvoiceStatus,
  parseChargeAmount,
  toPaymentRecord,
} from '../paymentCore';

export type ScopedChargeInput = PaymentGatewayChargeInput & { clientId?: string | null };

export class ManualBankTransferGateway implements PaymentGateway {
  async charge(input: ScopedChargeInput) {
    const amount = parseChargeAmount(input.amount);
    const payment = await prisma.$transaction(async (tx) => {
      // All payment methods lock the invoice before reading its outstanding balance.
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${input.invoiceId} FOR UPDATE`;
      const invoice = await loadPayableInvoice(
        (where) =>
          tx.invoice.findFirst({
            where,
            select: { id: true, status: true, total: true, paidAmount: true, clientId: true },
          }),
        input.invoiceId,
        input.clientId,
      );
      const existingKey = await tx.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existingKey && existingKey.deletedAt === null) {
        assertPaymentReplay(existingKey, { ...input, amount });
        return existingKey;
      }
      const pending = await tx.payment.aggregate({
        where: { invoiceId: invoice.id, status: 'PENDING', deletedAt: null },
        _sum: { amount: true },
      });
      assertAmountWithinBalance(invoice, amount, pending._sum.amount);
      const nextPaid = invoice.paidAmount.add(amount);
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
