import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    client: { findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    supportTicket: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ticketReply: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { listTickets, getTicket, createTicket, updateTicket, createReply } from './ticket.service';

const row = {
  id: 'tkt_1',
  code: 'TKT-2026-0001',
  subject: 'Caawimaad',
  description: 'Faahfaahin dheer',
  status: 'OPEN' as const,
  priority: 'MEDIUM' as const,
  projectId: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  client: { id: 'cl_1', companyName: 'Acme' },
  assignee: null,
  replies: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listTickets', () => {
  it('scopes to a client when clientId is provided', async () => {
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([row] as never);
    await listTickets('cl_1');
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, clientId: 'cl_1' } }),
    );
  });
});

describe('getTicket', () => {
  it('returns 404 for another client', async () => {
    vi.mocked(prisma.supportTicket.findFirst).mockResolvedValue(null as never);
    await expect(getTicket('tkt_1', 'cl_other')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(prisma.supportTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tkt_1', deletedAt: null, clientId: 'cl_other' },
      }),
    );
  });

  it('returns description and replies', async () => {
    vi.mocked(prisma.supportTicket.findFirst).mockResolvedValue({
      ...row,
      replies: [
        {
          id: 'r1',
          body: 'Salaan',
          createdAt: new Date('2026-09-02T00:00:00Z'),
          author: { id: 'u1', name: 'Hodan' },
        },
      ],
    } as never);
    const result = await getTicket('tkt_1');
    expect(result.description).toBe('Faahfaahin dheer');
    expect(result.replies[0]?.body).toBe('Salaan');
  });
});

describe('createTicket', () => {
  it('returns 404 when the client row is missing', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null as never);
    await expect(
      createTicket('ghost', {
        subject: 'Caawimaad',
        description: 'Faahfaahin dheer',
        priority: 'MEDIUM',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('updateTicket', () => {
  it('throws NOT_FOUND when the ticket is missing', async () => {
    vi.mocked(prisma.supportTicket.findFirst).mockResolvedValue(null as never);
    await expect(updateTicket('missing', { status: 'RESOLVED' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('assigns a staff member', async () => {
    vi.mocked(prisma.supportTicket.findFirst).mockResolvedValue(row as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'staff_1' } as never);
    vi.mocked(prisma.supportTicket.update).mockResolvedValue({
      ...row,
      assignee: { id: 'staff_1', name: 'Cali' },
    } as never);
    const result = await updateTicket('tkt_1', { assigneeId: 'staff_1' });
    expect(result.assignee?.id).toBe('staff_1');
  });
});

describe('createReply', () => {
  it('returns 404 for another client', async () => {
    vi.mocked(prisma.supportTicket.findFirst).mockResolvedValue(null as never);
    await expect(
      createReply('tkt_1', 'user_1', { body: 'Salaan' }, 'cl_other'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(prisma.ticketReply.create).not.toHaveBeenCalled();
  });

  it('stores the reply against the ticket', async () => {
    vi.mocked(prisma.supportTicket.findFirst).mockResolvedValue(row as never);
    vi.mocked(prisma.ticketReply.create).mockResolvedValue({
      id: 'r1',
      body: 'Salaan',
      createdAt: new Date('2026-09-02T00:00:00Z'),
      author: { id: 'user_1', name: 'Hodan' },
    } as never);
    const result = await createReply('tkt_1', 'user_1', { body: 'Salaan' }, 'cl_1');
    expect(result.body).toBe('Salaan');
    expect(result.author.name).toBe('Hodan');
  });
});
