import type {
  AdminTicket,
  CreateTicketInput,
  CreateTicketReplyInput,
  TicketDetail,
  TicketReply,
  UpdateTicketInput,
} from '@somwave/shared';
import { ROLES } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

const personSelect = { id: true, name: true } as const;

const listInclude = {
  client: { select: { id: true, companyName: true } },
  assignee: { select: personSelect },
} as const;

const detailInclude = {
  ...listInclude,
  replies: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: personSelect } },
  },
} as const;

type TicketRow = {
  id: string;
  code: string;
  subject: string;
  status: AdminTicket['status'];
  priority: AdminTicket['priority'];
  createdAt: Date;
  client: { id: string; companyName: string };
  assignee: { id: string; name: string } | null;
};

type TicketDetailRow = TicketRow & {
  description: string;
  projectId: string | null;
  replies: {
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; name: string };
  }[];
};

function toAdmin(row: TicketRow): AdminTicket {
  return {
    id: row.id,
    code: row.code,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    client: row.client,
    assignee: row.assignee,
  };
}

function toReply(row: TicketDetailRow['replies'][number]): TicketReply {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: row.author,
  };
}

function toDetail(row: TicketDetailRow): TicketDetail {
  return {
    ...toAdmin(row),
    description: row.description,
    projectId: row.projectId,
    replies: row.replies.map(toReply),
  };
}

function ownerWhere(id: string, clientId?: string | null) {
  return { id, deletedAt: null, ...(clientId ? { clientId } : {}) };
}

export async function listTickets(clientId?: string | null): Promise<AdminTicket[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { deletedAt: null, ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: listInclude,
  });
  return rows.map(toAdmin);
}

export async function getTicket(id: string, clientId?: string | null): Promise<TicketDetail> {
  const row = await prisma.supportTicket.findFirst({
    where: ownerWhere(id, clientId),
    include: detailInclude,
  });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Tikidhkan lama helin');
  return toDetail(row);
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
    include: listInclude,
  });
  return toAdmin(row);
}

const ASSIGNABLE_ROLES: readonly string[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.STAFF,
];

export async function listAssignees(): Promise<{ id: string; name: string }[]> {
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      roles: { some: { role: { name: { in: [...ASSIGNABLE_ROLES] } } } },
    },
    select: personSelect,
    orderBy: { name: 'asc' },
  });
  return rows;
}

export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
  clientId?: string | null,
): Promise<AdminTicket> {
  const existing = await prisma.supportTicket.findFirst({ where: ownerWhere(id, clientId) });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Tikidhkan lama helin');

  if (input.assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: input.assigneeId,
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { name: { in: [...ASSIGNABLE_ROLES] } } } },
      },
      select: { id: true },
    });
    if (!assignee) throw new AppError('VALIDATION_ERROR', 400, 'Shaqaalahan lama helin');
  }

  const row = await prisma.supportTicket.update({
    where: { id: existing.id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    },
    include: listInclude,
  });
  return toAdmin(row);
}

export async function createReply(
  ticketId: string,
  authorId: string,
  input: CreateTicketReplyInput,
  clientId?: string | null,
): Promise<TicketReply> {
  const ticket = await prisma.supportTicket.findFirst({
    where: ownerWhere(ticketId, clientId),
  });
  if (!ticket) throw new AppError('NOT_FOUND', 404, 'Tikidhkan lama helin');

  const row = await prisma.ticketReply.create({
    data: { ticketId: ticket.id, authorId, body: input.body },
    include: { author: { select: personSelect } },
  });
  return toReply(row);
}
