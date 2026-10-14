import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PERMISSIONS, type AuthUser } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn(), updateMany: vi.fn() },
    projectExpense: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    projectBudgetRevision: { findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) => operation(prisma)),
  },
}));
import { prisma } from '../lib/prisma';
import {
  createProjectExpense,
  getProjectFinance,
  reviseProjectBudget,
} from './project-finance.service';

const manager: AuthUser = {
  id: 'manager',
  name: 'Manager',
  email: 'manager@example.com',
  roles: ['MANAGER'],
  permissions: [PERMISSIONS.INVOICES_READ, PERMISSIONS.INVOICES_UPDATE],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findFirst).mockResolvedValue({
    id: 'project',
    budget: new Prisma.Decimal('1000'),
  } as never);
  vi.mocked(prisma.projectExpense.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.projectBudgetRevision.findMany).mockResolvedValue([] as never);
});

describe('project finance', () => {
  it('rejects an engineer without finance permission before querying money', async () => {
    await expect(
      getProjectFinance('project', { ...manager, roles: ['ENGINEER'], permissions: [] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });

  it('limits finance to projects in the actor scope', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
    await expect(getProjectFinance('other-project', manager)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  it('calculates planned, actual, category, and utilization totals using decimals', async () => {
    vi.mocked(prisma.projectExpense.findMany).mockResolvedValue([
      {
        id: 'one',
        kind: 'PLANNED',
        category: 'Hosting',
        description: 'Annual',
        amount: new Prisma.Decimal('300.15'),
        expenseDate: null,
        actorId: 'manager',
        createdAt: new Date('2026-10-01'),
      },
      {
        id: 'two',
        kind: 'ACTUAL',
        category: 'Hosting',
        description: 'Monthly',
        amount: new Prisma.Decimal('120.25'),
        expenseDate: null,
        actorId: 'manager',
        createdAt: new Date('2026-10-02'),
      },
    ] as never);
    const result = await getProjectFinance('project', manager);
    expect(result).toMatchObject({
      plannedExpenses: '300.15',
      actualExpenses: '120.25',
      utilizationPercent: 12,
    });
    expect(result.categories).toEqual([
      { category: 'Hosting', planned: '300.15', actual: '120.25' },
    ]);
  });

  it('records a budget revision and audit event in the same transaction', async () => {
    vi.mocked(prisma.project.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.projectBudgetRevision.create).mockResolvedValue({ id: 'revision' } as never);
    const result = await reviseProjectBudget('project', manager, {
      budget: '1200.00',
      reason: 'Additional infrastructure',
    });
    expect(result.budget).toBe('1200');
    expect(prisma.projectBudgetRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project',
          previousBudget: new Prisma.Decimal('1000'),
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'project.budget.revise', subjectId: 'project' }),
      }),
    );
  });

  it('rejects an expense for a project the manager cannot administer', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
    await expect(
      createProjectExpense('other-project', manager, {
        kind: 'ACTUAL',
        category: 'Hosting',
        description: 'Invoice',
        amount: '42.00',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.projectExpense.create).not.toHaveBeenCalled();
  });
});
