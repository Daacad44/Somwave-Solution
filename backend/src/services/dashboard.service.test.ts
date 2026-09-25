import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PERMISSIONS, ROLES, type AuthUser } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findMany: vi.fn(), count: vi.fn() },
    task: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    inquiry: { findMany: vi.fn(), count: vi.fn() },
    client: { count: vi.fn() },
    supportTicket: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    invoice: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    clientDocument: { findMany: vi.fn(), count: vi.fn() },
    milestone: { findMany: vi.fn() },
    employee: { count: vi.fn() },
    jobApplication: { count: vi.fn() },
    leaveRequest: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
    service: { count: vi.fn() },
    post: { count: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { getDashboard } from './dashboard.service';

function auth(partial: Partial<AuthUser>): AuthUser {
  return {
    id: 'u1',
    email: 'a@b.com',
    name: 'Cali',
    roles: [ROLES.ADMIN],
    permissions: [],
    clientId: null,
    twoFactorEnabled: true,
    twoFactorRequired: true,
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDashboard', () => {
  it('returns an isolated client payload and never queries unscoped projects', async () => {
    const client = auth({
      roles: [ROLES.CLIENT],
      clientId: 'cl_1',
      permissions: [
        PERMISSIONS.PORTAL_READ,
        PERMISSIONS.TICKETS_READ,
        PERMISSIONS.INVOICES_READ,
        PERMISSIONS.DOCUMENTS_READ,
      ],
    });
    vi.mocked(prisma.project.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.project.count).mockResolvedValue(0);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.aggregate).mockResolvedValue({ _sum: { paidAmount: null } } as never);
    vi.mocked(prisma.clientDocument.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.clientDocument.count).mockResolvedValue(0);
    vi.mocked(prisma.milestone.findMany).mockResolvedValue([] as never);

    const result = await getDashboard(client, '30d');
    expect(result.kind).toBe('client');
    expect(result.focus).toBe('client');
    expect(result.kpis.openLeads).toBeUndefined();
    expect(result.kpis.employees).toBeUndefined();
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'cl_1' }),
      }),
    );
    expect(prisma.inquiry.count).not.toHaveBeenCalled();
    expect(prisma.employee.count).not.toHaveBeenCalled();
  });

  it('omits KPIs the user cannot read', async () => {
    const editor = auth({
      roles: [ROLES.EDITOR],
      permissions: [PERMISSIONS.CONTENT_READ],
    });
    vi.mocked(prisma.service.count).mockResolvedValue(3);
    vi.mocked(prisma.post.count).mockResolvedValue(2);

    const result = await getDashboard(editor, '7d');
    expect(result.focus).toBe('editor');
    expect(result.kpis.projects).toBeUndefined();
    expect(result.kpis.openTasks).toBeUndefined();
    expect(result.modules.some((module) => module.to === '/cms/services')).toBe(true);
    expect(prisma.project.count).not.toHaveBeenCalled();
  });

  it('does not invent a trend when the previous period is empty', async () => {
    const admin = auth({
      roles: [ROLES.SUPER_ADMIN],
      permissions: [PERMISSIONS.PROJECTS_READ],
    });
    vi.mocked(prisma.project.count)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    vi.mocked(prisma.project.findMany).mockResolvedValue([] as never);

    const result = await getDashboard(admin, '30d');
    expect(result.kpis.projects?.value).toBe(4);
    expect(result.kpis.projects?.trend).toBeNull();
  });
});
