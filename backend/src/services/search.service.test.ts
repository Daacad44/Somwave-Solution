import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, ROLES } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    client: { findMany: vi.fn() },
    inquiry: { findMany: vi.fn() },
    supportTicket: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    service: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
    clientDocument: { findMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { searchRecords } from './search.service';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.task.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
});

describe('searchRecords', () => {
  it('returns nothing for a query that is too short', async () => {
    const result = await searchRecords('a', {
      permissions: [PERMISSIONS.PROJECTS_READ],
      roles: [ROLES.STAFF],
      clientId: null,
    });
    expect(result).toEqual([]);
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('does not search internal records for a client', async () => {
    await searchRecords('web', {
      permissions: [PERMISSIONS.PORTAL_READ, PERMISSIONS.TICKETS_READ, PERMISSIONS.PROJECTS_READ],
      roles: [ROLES.CLIENT],
      clientId: 'cl_1',
    });
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'cl_1' }),
      }),
    );
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'cl_1' }),
      }),
    );
  });

  it('returns no owned records when a client has no company', async () => {
    const result = await searchRecords('web', {
      permissions: [PERMISSIONS.PORTAL_READ, PERMISSIONS.INVOICES_READ],
      roles: [ROLES.CLIENT],
      clientId: null,
    });
    expect(result).toEqual([]);
    expect(prisma.project.findMany).not.toHaveBeenCalled();
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });
});
