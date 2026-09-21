import { Prisma } from '@prisma/client';
import type { PaymentRecord, RecordPaymentInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

export interface ChargeInput extends RecordPaymentInput {
  actorId: string;
  idempotencyKey: string;
}

export interface PaymentGateway {
  charge(input: ChargeInput): Promise<PaymentRecord>;
}

function toRecord(row: {
  id: string;
  invoiceId: string;
  amount: Prisma.Decimal;
  method: PaymentRecord['method'];
  status: PaymentRecord['status'];
  reference: string | null;
  createdAt: Date;
}): PaymentRecord {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    amount: row.amount.toFixed(2),
    method: row.method,
    status: row.status,
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
  };
}

function nextInvoiceStatus(
  current: string,
  paid: Prisma.Decimal,
  total: Prisma.Decimal,
): 'PARTIAL' | 'PAID' | 'OVERDUE' {
  if (paid.gte(total)) return 'PAID';
  if (current === 'OVERDUE') return 'OVERDUE';
  return 'PARTIAL';
}

class ManualBankTransferGateway implements PaymentGateway {
  async charge(input: ChargeInput): Promise<PaymentRecord> {
    const existingKey = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existingKey && existingKey.deletedAt === null) {
      return toRecord(existingKey);
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, deletedAt: null },
    });
    if (!invoice) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
    if (invoice.status === 'VOID' || invoice.status === 'DRAFT') {
      throw new AppError('CONFLICT', 409, 'Biilkan lacag lagama dhigi karo');
    }

    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Qiimaha waa inuu ka weynaadaa eber');
    }
    const nextPaid = invoice.paidAmount.add(amount);
    if (nextPaid.gt(invoice.total)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Lacagtu way ka badan tahay hadhaaga');
    }

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

    return toRecord(payment);
  }
}

const defaultGateway: PaymentGateway = new ManualBankTransferGateway();

export async function recordPayment(
  input: ChargeInput,
  gateway: PaymentGateway = defaultGateway,
): Promise<PaymentRecord> {
  return gateway.charge(input);
}

export async function listPayments(invoiceId: string): Promise<PaymentRecord[]> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: { id: true },
  });
  if (!invoice) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
  const rows = await prisma.payment.findMany({
    where: { invoiceId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toRecord);
}
