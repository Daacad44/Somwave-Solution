import type {
  ChargeEvcPaymentInput,
  PaymentGateway,
  PaymentRecord,
  RecordPaymentInput,
} from '@somwave/shared';
import { AppError } from '../lib/http';
import { prisma } from '../lib/prisma';
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

function gatewayForMethod(method: RecordPaymentInput['method']): PaymentGateway {
  if (method === 'EVC_PLUS') return evcGateway;
  return manualGateway;
}

export async function recordPayment(
  input: ChargeInput,
  gateway?: PaymentGateway,
): Promise<PaymentRecord> {
  if (input.method === 'EVC_PLUS') {
    throw new AppError('VALIDATION_ERROR', 400, 'Isticmaal /payments/evc-plus EVC Plus');
  }
  const impl = gateway ?? gatewayForMethod(input.method);
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
  if (!invoice) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
  const rows = await prisma.payment.findMany({
    where: { invoiceId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPaymentRecord);
}

export async function applyEvcWebhook(payload: EvcWebhookPayload): Promise<PaymentRecord | null> {
  const payment = await prisma.payment.findFirst({
    where: { gatewayRef: payload.transactionId, deletedAt: null, method: 'EVC_PLUS' },
  });
  if (!payment) return null;
  if (payment.status !== 'PENDING') {
    return toPaymentRecord(payment);
  }

  if (payload.status === 'FAILED') {
    const failed = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', reference: payload.reference ?? payment.reference },
    });
    return toPaymentRecord(failed);
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: payment.invoiceId, deletedAt: null },
  });
  if (!invoice) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');

  const nextPaid = invoice.paidAmount.add(payment.amount);
  if (nextPaid.gt(invoice.total)) {
    throw new AppError('PAYMENT_FAILED', 409, 'Lacagtu way ka badan tahay hadhaaga');
  }

  const completed = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        reference: payload.reference ?? payment.reference,
      },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: nextPaid,
        status: nextInvoiceStatus(invoice.status, nextPaid, invoice.total),
      },
    });
    return updatedPayment;
  });

  return toPaymentRecord(completed);
}
