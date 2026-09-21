import { Prisma } from '@prisma/client';
import type {
  AdminInvoice,
  CreateInvoiceInput,
  InvoiceDetail,
  InvoiceStatus,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { sendMail } from '../lib/mailer';
import { INVOICE_SENT_V1 } from '../mail/templates';

type InvoiceRow = {
  id: string;
  number: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  subtotal: Prisma.Decimal;
  tax: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  createdAt: Date;
  client: { id: string; companyName: string };
  project: { id: string; name: string } | null;
};

type InvoiceDetailRow = InvoiceRow & {
  items: {
    id: string;
    description: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }[];
};

const listInclude = {
  client: { select: { id: true, companyName: true } },
  project: { select: { id: true, name: true } },
} as const;

const detailInclude = {
  ...listInclude,
  items: { orderBy: { id: 'asc' as const } },
};

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function effectiveStatus(row: { status: InvoiceStatus; dueDate: Date }): InvoiceStatus {
  if (row.status === 'SENT' && row.dueDate.getTime() < Date.now()) return 'OVERDUE';
  return row.status;
}

function toAdmin(row: InvoiceRow): AdminInvoice {
  return {
    id: row.id,
    number: row.number,
    status: effectiveStatus(row),
    issueDate: row.issueDate.toISOString(),
    dueDate: row.dueDate.toISOString(),
    subtotal: money(row.subtotal),
    tax: money(row.tax),
    discount: money(row.discount),
    total: money(row.total),
    paidAmount: money(row.paidAmount),
    createdAt: row.createdAt.toISOString(),
    client: row.client,
    project: row.project,
  };
}

function toDetail(row: InvoiceDetailRow): InvoiceDetail {
  return {
    ...toAdmin(row),
    items: row.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: money(item.quantity),
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
    })),
  };
}

function ownerWhere(id: string, clientId?: string | null) {
  return { id, deletedAt: null, ...(clientId ? { clientId } : {}) };
}

async function markOverdue(): Promise<void> {
  await prisma.invoice.updateMany({
    where: { deletedAt: null, status: 'SENT', dueDate: { lt: new Date() } },
    data: { status: 'OVERDUE' },
  });
}

export async function listInvoices(clientId?: string | null): Promise<AdminInvoice[]> {
  await markOverdue();
  const rows = await prisma.invoice.findMany({
    where: { deletedAt: null, ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: listInclude,
  });
  return rows.map(toAdmin);
}

export async function getInvoice(id: string, clientId?: string | null): Promise<InvoiceDetail> {
  await markOverdue();
  const row = await prisma.invoice.findFirst({
    where: ownerWhere(id, clientId),
    include: detailInclude,
  });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
  return toDetail(row);
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDetail> {
  const client = await prisma.client.findFirst({ where: { id: input.clientId, deletedAt: null } });
  if (!client) throw new AppError('VALIDATION_ERROR', 400, 'Macmiilkan lama helin');
  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null, clientId: input.clientId },
    });
    if (!project) throw new AppError('VALIDATION_ERROR', 400, 'Mashruucan lama helin');
  }

  const items = input.items.map((item) => {
    const quantity = new Prisma.Decimal(item.quantity);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    return {
      description: item.description,
      quantity,
      unitPrice,
      lineTotal: quantity.mul(unitPrice),
    };
  });
  const subtotal = items.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));
  const tax = new Prisma.Decimal(input.tax);
  const discount = new Prisma.Decimal(input.discount);
  const total = subtotal.add(tax).sub(discount);
  if (total.lt(0)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Qiimo-dhimista kama badnaan karto wadarta');
  }

  const year = new Date().getUTCFullYear();
  const count = await prisma.invoice.count();
  const number = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

  const row = await prisma.invoice.create({
    data: {
      number,
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      issueDate: new Date(input.issueDate),
      dueDate: new Date(input.dueDate),
      subtotal,
      tax,
      discount,
      total,
      items: { create: items },
    },
    include: detailInclude,
  });
  return toDetail(row);
}

const SENDABLE: ReadonlySet<InvoiceStatus> = new Set(['DRAFT']);
const ALREADY_SENT: ReadonlySet<InvoiceStatus> = new Set(['SENT', 'OVERDUE', 'PARTIAL', 'PAID']);
const VOIDABLE: ReadonlySet<InvoiceStatus> = new Set(['DRAFT', 'SENT', 'OVERDUE', 'PARTIAL']);

export async function sendInvoice(id: string, clientId?: string | null): Promise<InvoiceDetail> {
  const existing = await prisma.invoice.findFirst({
    where: ownerWhere(id, clientId),
    include: detailInclude,
  });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');

  const status = effectiveStatus(existing);
  if (ALREADY_SENT.has(status) || ALREADY_SENT.has(existing.status)) {
    return toDetail({ ...existing, status });
  }
  if (!SENDABLE.has(existing.status)) {
    throw new AppError('CONFLICT', 409, 'Biilkan lama diri karo');
  }

  const nextStatus: InvoiceStatus = existing.dueDate.getTime() < Date.now() ? 'OVERDUE' : 'SENT';
  const row = await prisma.invoice.update({
    where: { id: existing.id },
    data: { status: nextStatus },
    include: detailInclude,
  });
  const detail = toDetail(row);
  const recipient = await prisma.client.findFirst({
    where: { id: existing.clientId },
    select: { email: true },
  });
  if (recipient?.email) {
    await sendMail({
      to: recipient.email,
      template: INVOICE_SENT_V1,
      vars: {
        number: detail.number,
        total: detail.total,
        dueDate: detail.dueDate.slice(0, 10),
      },
    });
  }
  return detail;
}

export async function voidInvoice(id: string, clientId?: string | null): Promise<InvoiceDetail> {
  const existing = await prisma.invoice.findFirst({
    where: ownerWhere(id, clientId),
    include: detailInclude,
  });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
  if (existing.status === 'VOID') return toDetail(existing);
  if (existing.status === 'PAID' || !VOIDABLE.has(existing.status)) {
    throw new AppError('CONFLICT', 409, 'Biilkan lama burin karo');
  }

  const row = await prisma.invoice.update({
    where: { id: existing.id },
    data: { status: 'VOID' },
    include: detailInclude,
  });
  return toDetail(row);
}
