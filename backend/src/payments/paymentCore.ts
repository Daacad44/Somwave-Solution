import { Prisma } from '@prisma/client';
import type { PaymentRecord } from '@somwave/shared';
import { AppError } from '../lib/http';

export function toPaymentRecord(row: {
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

export function nextInvoiceStatus(
  current: string,
  paid: Prisma.Decimal,
  total: Prisma.Decimal,
): 'PARTIAL' | 'PAID' | 'OVERDUE' {
  if (paid.gte(total)) return 'PAID';
  if (current === 'OVERDUE') return 'OVERDUE';
  return 'PARTIAL';
}

export function parseChargeAmount(amount: string): Prisma.Decimal {
  const value = new Prisma.Decimal(amount);
  if (value.lte(0)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Qiimaha waa inuu ka weynaadaa eber');
  }
  return value;
}

export type InvoiceForPayment = {
  id: string;
  status: string;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  clientId: string;
};

export async function loadPayableInvoice(
  findFirst: (where: {
    id: string;
    deletedAt: null;
    clientId?: string;
  }) => Promise<InvoiceForPayment | null>,
  invoiceId: string,
  clientId?: string | null,
): Promise<InvoiceForPayment> {
  const invoice = await findFirst({
    id: invoiceId,
    deletedAt: null,
    ...(clientId ? { clientId } : {}),
  });
  if (!invoice) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
  if (invoice.status === 'VOID' || invoice.status === 'DRAFT') {
    throw new AppError('CONFLICT', 409, 'Biilkan lacag lagama dhigi karo');
  }
  return invoice;
}

export function assertAmountWithinBalance(
  invoice: InvoiceForPayment,
  amount: Prisma.Decimal,
): void {
  const nextPaid = invoice.paidAmount.add(amount);
  if (nextPaid.gt(invoice.total)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Lacagtu way ka badan tahay hadhaaga');
  }
}
