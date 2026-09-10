import type { AdminTicket, CreateTicketInput, TicketStatus } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

function toAdmin(row: {
  id: string;
  code: string;
  subject: string;
  status: AdminTicket['status'];
  priority: AdminTicket['priority'];
  createdAt: Date;
  client: { id: string; companyName: string };
}): AdminTicket {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listTickets(clientId?: string | null): Promise<AdminTicket[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { deletedAt: null, ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { id: true, companyName: true } } },
  });
  return rows.map(toAdmin);
}

export async function createTicket(
  clientId: string,
  input: CreateTicketInput,
): Promise<AdminTicket> {
  const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
  if (!client) throw new AppError('NOT_FOUND', 404, 'Macmiilkan lama helin');
  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null, clientId },
    });
    if (!project) throw new AppError('VALIDATION_ERROR', 400, 'Mashruucan lama helin');
  }
  const year = new Date().getUTCFullYear();
  const count = await prisma.supportTicket.count();
  const code = `TKT-${year}-${String(count + 1).padStart(4, '0')}`;
  const row = await prisma.supportTicket.create({
    data: {
      code,
      clientId,
      projectId: input.projectId ?? null,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
    },
    include: { client: { select: { id: true, companyName: true } } },
  });
  return toAdmin(row);
}

export async function updateTicketStatus(id: string, status: TicketStatus): Promise<AdminTicket> {
  const existing = await prisma.supportTicket.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Tikidhkan lama helin');
  const row = await prisma.supportTicket.update({
    where: { id },
    data: { status },
    include: { client: { select: { id: true, companyName: true } } },
  });
  return toAdmin(row);
}
