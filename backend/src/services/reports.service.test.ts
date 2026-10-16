import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, ROLES, type AuthUser } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { count: vi.fn(), findMany: vi.fn() },
    task: { groupBy: vi.fn() },
    projectInquiry: { count: vi.fn(), findMany: vi.fn() },
    invoice: { count: vi.fn(), findMany: vi.fn() },
    portfolioItem: { count: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { getReport, listReportCatalog, reportToCsv } from './reports.service';

const engineer: AuthUser = {
  id: 'eng-1',
  email: 'engineer@example.com',
  name: 'Engineer',
  roles: [ROLES.ENGINEER],
  permissions: [PERMISSIONS.PROJECTS_READ],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};
const query = {
  from: new Date('2026-10-01T00:00:00.000Z'),
  to: new Date('2026-11-01T00:00:00.000Z'),
  page: 1,
  pageSize: 25,
};

describe('Reports access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only advertises reports the actor may read and requires finance MFA proof', () => {
    expect(listReportCatalog(engineer).reports.map((item) => item.key)).toEqual(['projects']);
    const financeUser = {
      ...engineer,
      permissions: [PERMISSIONS.FINANCE_READ],
      twoFactorEnabled: true,
    };
    expect(listReportCatalog(financeUser).reports).toEqual([]);
    expect(listReportCatalog(financeUser, Date.now()).reports.map((item) => item.key)).toEqual([
      'trial-balance',
    ]);
  });

  it('denies direct unauthorized report access before querying', async () => {
    await expect(getReport(engineer, 'audit', query)).rejects.toMatchObject({ status: 403 });
    await expect(getReport(engineer, 'trial-balance', query)).rejects.toMatchObject({
      status: 403,
    });
    expect(prisma.project.count).not.toHaveBeenCalled();
  });

  it('scopes project rows and counts to the actor’s assigned projects', async () => {
    vi.mocked(prisma.project.count).mockResolvedValue(1);
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      {
        id: 'p-1',
        name: 'Scoped project',
        status: 'ACTIVE',
        dueDate: null,
        client: null,
        manager: null,
      },
    ] as never);
    vi.mocked(prisma.task.groupBy).mockResolvedValue([
      { projectId: 'p-1', status: 'DONE', _count: { _all: 1 } },
      { projectId: 'p-1', status: 'TODO', _count: { _all: 1 } },
    ] as never);
    const result = await getReport(engineer, 'projects', query);
    expect(result.meta.total).toBe(1);
    expect(result.rows[0]).toMatchObject({ id: 'p-1', taskCompletion: 50 });
    for (const call of [
      vi.mocked(prisma.project.count).mock.calls[0],
      vi.mocked(prisma.project.findMany).mock.calls[0],
    ]) {
      expect(call?.[0]?.where).toMatchObject({
        deletedAt: null,
        OR: [{ managerId: 'eng-1' }, { members: { some: { userId: 'eng-1', removedAt: null } } }],
      });
    }
  });

  it('reports actual project requests without exposing email or verification secrets', async () => {
    vi.mocked(prisma.projectInquiry.count).mockResolvedValue(1);
    vi.mocked(prisma.projectInquiry.findMany).mockResolvedValue([
      {
        id: 'request-1',
        name: 'Requester',
        email: 'private@example.com',
        verificationCodeHash: 'secret',
        companyName: 'Company',
        projectType: 'WEBSITE',
        status: 'UNDER_REVIEW',
        createdAt: query.from,
      },
    ] as never);
    const staff = { ...engineer, permissions: [PERMISSIONS.LEADS_READ] };
    const result = await getReport(staff, 'project-inquiries', {
      ...query,
      status: 'UNDER_REVIEW',
    });
    expect(result.meta.total).toBe(1);
    expect(result.rows[0]).toMatchObject({ id: 'request-1', status: 'UNDER_REVIEW' });
    expect(JSON.stringify(result.rows)).not.toContain('private@example.com');
    expect(JSON.stringify(result.rows)).not.toContain('secret');
    expect(prisma.projectInquiry.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'UNDER_REVIEW',
        createdAt: { gte: query.from, lt: query.to },
      }),
    });
  });

  it('limits client project and billing reports to the authenticated client', async () => {
    const client = {
      ...engineer,
      roles: [ROLES.CLIENT],
      permissions: [PERMISSIONS.PORTAL_READ, PERMISSIONS.INVOICES_READ],
      clientId: 'client-1',
    };
    vi.mocked(prisma.project.count).mockResolvedValue(0);
    vi.mocked(prisma.project.findMany).mockResolvedValue([]);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
    await getReport(client, 'my-projects', query);
    await getReport(client, 'my-invoices', query);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'client-1', deletedAt: null }),
      }),
    );
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: 'client-1',
          deletedAt: null,
          status: { notIn: ['DRAFT', 'VOID'] },
        }),
      }),
    );
    await expect(
      getReport({ ...client, clientId: null }, 'my-invoices', query),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('uses recorded lifetime demo-click counts without fabricating portfolio views', async () => {
    vi.mocked(prisma.portfolioItem.count).mockResolvedValue(1);
    vi.mocked(prisma.portfolioItem.findMany).mockResolvedValue([
      {
        id: 'portfolio-1',
        title: 'Project',
        category: 'WEBSITE',
        isPublished: true,
        demoClicks: 7,
        createdAt: query.from,
      },
    ] as never);
    const editor = { ...engineer, permissions: [PERMISSIONS.CONTENT_READ] };
    const result = await getReport(editor, 'portfolio', query);
    expect(result.rows[0]).toMatchObject({ demoClicks: 7 });
    expect(result.columns.some((column) => column.key === 'views')).toBe(false);
  });
});

describe('CSV export', () => {
  it('quotes cells and neutralizes spreadsheet formulas', () => {
    expect(
      reportToCsv([{ key: 'name', label: 'Name' }], [{ name: '=SUM(1,1)' }, { name: 'a"b' }]),
    ).toBe('"Name"\r\n"\'=SUM(1,1)"\r\n"a""b"\r\n');
  });
});
