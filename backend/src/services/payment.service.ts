import type {
  ChargeEvcPaymentInput,
  PaymentGateway,
  PaymentRecord,
  RecordPaymentInput,
} from '@somwave/shared';
import { AppError } from '../lib/http';
import { prisma } from '../lib/prisma';
import { recordAudit } from '../lib/audit';
import { nextInvoiceStatus, toPaymentRecord } from '../payments/paymentCore';
import { EvcPlusGateway, type ScopedChargeInput } from '../payments/gateways/evcplus.gateway';
import { ManualBankTransferGateway } from '../payments/gateways/manualBank.gateway';
import type { EvcWebhookPayload } from '@somwave/shared';

export interface ChargeInput extends RecordPaymentInput {
  actorId: string;
  idempotencyKey: string;
  clientId?: string | null;
}

export interface EvcChargeInput extends ChargeEvcPaymentInput {
  actorId: string;
  idempotencyKey: string;
  clientId?: string | null;
}

const manualGateway = new ManualBankTransferGateway();
const evcGateway = new EvcPlusGateway();

export async function recordPayment(
  input: ChargeInput,
  gateway?: PaymentGateway,
): Promise<PaymentRecord> {
  if (input.method === 'EVC_PLUS') {
    throw new AppError('VALIDATION_ERROR', 400, 'Isticmaal /payments/evc-plus EVC Plus');
  }
  if (input.method !== 'BANK_TRANSFER' && input.method !== 'MANUAL') {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Payment method has no configured settlement gateway',
    );
  }
  const impl = gateway ?? manualGateway;
  return impl.charge(input as ScopedChargeInput);
}

export async function chargeEvcPlus(input: EvcChargeInput): Promise<PaymentRecord> {
  return evcGateway.charge({
    invoiceId: input.invoiceId,
    amount: input.amount,
    method: 'EVC_PLUS',
    actorId: input.actorId,
    idempotencyKey: input.idempotencyKey,
    payerPhone: input.phone,
    clientId: input.clientId,
  });
}

export async function listPayments(
  invoiceId: string,
  clientId?: string | null,
): Promise<PaymentRecord[]> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null, ...(clientId ? { clientId } : {}) },
    select: { id: true },
  });
  if (!invoice) throw new AppError('NOT_FOUND', 404, 'Invoice not found');
  const rows = await prisma.payment.findMany({
    where: { invoiceId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPaymentRecord);
}

export async function applyEvcWebhook(payload: EvcWebhookPayload): Promise<PaymentRecord | null> {
  const known = await prisma.payment.findFirst({
    where: { gatewayRef: payload.transactionId, deletedAt: null, method: 'EVC_PLUS' },
    select: { invoiceId: true },
  });
  if (!known) return null;

  const result = await prisma.$transaction(async (tx) => {
    // Serialize webhook retries and manual payments against the same invoice.
    await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${known.invoiceId} FOR UPDATE`;
    const payment = await tx.payment.findFirst({
      where: { gatewayRef: payload.transactionId, deletedAt: null, method: 'EVC_PLUS' },
    });
    if (!payment) return null;
    if (payment.status !== 'PENDING') return payment;
    const reference = payload.reference ?? payment.reference;
    if (payload.status === 'FAILED') {
      // Conditional claim: only the callback that moves PENDING wins.
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED', reference },
      });
      if (claimed.count === 1) {
        await recordAudit(tx, {
          action: 'payment.evc.failed',
          subjectType: 'Payment',
          subjectId: payment.id,
          before: { status: 'PENDING' },
          after: { status: 'FAILED' },
          metadata: { transactionId: payload.transactionId },
        });
      }
      return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    }
    const invoice = await tx.invoice.findFirst({
      where: { id: payment.invoiceId, deletedAt: null },
    });
    if (!invoice) throw new AppError('NOT_FOUND', 404, 'Invoice not found');
    if (invoice.status === 'VOID')
      throw new AppError('CONFLICT', 409, 'A void invoice cannot accept a payment');
    const nextPaid = invoice.paidAmount.add(payment.amount);
    if (nextPaid.gt(invoice.total)) {
      throw new AppError('PAYMENT_FAILED', 409, 'Payment exceeds the outstanding balance');
    }
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'COMPLETED', reference },
    });
    if (claimed.count === 0) return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const status = nextInvoiceStatus(invoice.status, nextPaid, invoice.total);
    await tx.invoice.update({
      where: { id: invoice.id },
      // Increment, never overwrite: the credit is relative to the locked balance.
      data: { paidAmount: { increment: payment.amount }, status },
    });
    await recordAudit(tx, {
      action: 'payment.evc.completed',
      subjectType: 'Payment',
      subjectId: payment.id,
      before: { status: 'PENDING', invoicePaidAmount: invoice.paidAmount.toFixed(2) },
      after: { status: 'COMPLETED', invoicePaidAmount: nextPaid.toFixed(2), invoiceStatus: status },
      metadata: { invoiceId: invoice.id, transactionId: payload.transactionId },
    });
    return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
  });
  return result ? toPaymentRecord(result) : null;
}
