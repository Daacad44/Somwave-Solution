import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    client: { findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
    supportTicket: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';
import { listTickets, createTicket, updateTicketStatus } from './ticket.service';

const row = {
  id: 'tkt_1',
  code: 'TKT-2026-0001',
  subject: 'Caawimaad',
  status: 'OPEN' as const,
  priority: 'MEDIUM' as const,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  client: { id: 'cl_1', companyName: 'Acme' },
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

describe('updateTicketStatus', () => {
  it('throws NOT_FOUND when the ticket is missing', async () => {
    vi.mocked(prisma.supportTicket.findFirst).mockResolvedValue(null as never);
    await expect(updateTicketStatus('missing', 'RESOLVED')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
