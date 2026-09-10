import { Prisma } from '@prisma/client';
import type { AdminInvoice, CreateInvoiceInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

function toAdmin(row: {
  id: string;
  number: string;
  status: AdminInvoice['status'];
  issueDate: Date;
  dueDate: Date;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  createdAt: Date;
  client: { id: string; companyName: string };
  project: { id: string; name: string } | null;
}): AdminInvoice {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    issueDate: row.issueDate.toISOString(),
    dueDate: row.dueDate.toISOString(),
    total: row.total.toFixed(2),
    paidAmount: row.paidAmount.toFixed(2),
    createdAt: row.createdAt.toISOString(),
    client: row.client,
    project: row.project,
  };
}

const include = {
  client: { select: { id: true, companyName: true } },
  project: { select: { id: true, name: true } },
} as const;

export async function listInvoices(clientId?: string | null): Promise<AdminInvoice[]> {
  const rows = await prisma.invoice.findMany({
    where: { deletedAt: null, ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: 'desc' },
    include,
  });
  return rows.map(toAdmin);
}

export async function createInvoice(input: CreateInvoiceInput): Promise<AdminInvoice> {
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
      total: subtotal,
      items: { create: items },
    },
    include,
  });
  return toAdmin(row);
}
