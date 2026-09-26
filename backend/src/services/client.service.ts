import type {
  AdminClient,
  ClientProfile,
  CreateClientInput,
  InvoiceStatus,
  ProjectStatus,
  UpdateClientInput,
} from '@somwave/shared';
import { deriveProgress } from './project.service';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

function toAdmin(row: {
  id: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  status: AdminClient['status'];
  createdAt: Date;
}): AdminClient {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listClients(): Promise<AdminClient[]> {
  const rows = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toAdmin);
}

export async function createClient(input: CreateClientInput): Promise<AdminClient> {
  const row = await prisma.client.create({
    data: {
      companyName: input.companyName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      status: input.status,
    },
  });
  return toAdmin(row);
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<AdminClient> {
  const existing = await prisma.client.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Macmiilkan lama helin');
  const row = await prisma.client.update({
    where: { id },
    data: {
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  return toAdmin(row);
}

function invoiceStatus(status: InvoiceStatus, dueDate: Date): InvoiceStatus {
  if (status === 'SENT' && dueDate.getTime() < Date.now()) return 'OVERDUE';
  return status;
}

export async function getClientProfile(id: string): Promise<ClientProfile> {
  const client = await prisma.client.findFirst({ where: { id, deletedAt: null } });
  if (!client) throw new AppError('NOT_FOUND', 404, 'Macmiilkan lama helin');

  const [projects, invoices, tickets, documents] = await Promise.all([
    prisma.project.findMany({
      where: { clientId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, status: true, dueDate: true },
    }),
    prisma.invoice.findMany({
      where: { clientId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, number: true, status: true, total: true, dueDate: true },
    }),
    prisma.supportTicket.findMany({
      where: { clientId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, code: true, subject: true, status: true, priority: true },
    }),
    prisma.clientDocument.findMany({
      where: { clientId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  const projectIds = projects.map((project) => project.id);
  const grouped =
    projectIds.length === 0
      ? []
      : await prisma.task.groupBy({
          by: ['projectId', 'status'],
          where: { deletedAt: null, projectId: { in: projectIds } },
          _count: { _all: true },
        });

  const totals = new Map<string, { total: number; done: number }>();
  for (const row of grouped) {
    const current = totals.get(row.projectId) ?? { total: 0, done: 0 };
    current.total += row._count._all;
    if (row.status === 'DONE') current.done += row._count._all;
    totals.set(row.projectId, current);
  }

  return {
    ...toAdmin(client),
    projects: projects.map((project) => {
      const counts = totals.get(project.id) ?? { total: 0, done: 0 };
      return {
        id: project.id,
        name: project.name,
        status: project.status as ProjectStatus,
        dueDate: project.dueDate?.toISOString() ?? null,
        progress: deriveProgress(counts.total, counts.done),
      };
    }),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoiceStatus(invoice.status, invoice.dueDate),
      total: invoice.total.toFixed(2),
      dueDate: invoice.dueDate.toISOString(),
    })),
    tickets,
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      createdAt: document.createdAt.toISOString(),
    })),
  };
}
