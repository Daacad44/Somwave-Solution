import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../lib/env', () => ({ env: { FINANCE_BASE_CURRENCY: 'USD' } }));
vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findMany: vi.fn(), findFirst: vi.fn() },
    invoice: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    projectExpense: { findMany: vi.fn() },
    financeTransaction: { findMany: vi.fn() },
    projectBudgetRevision: { findMany: vi.fn() },
    projectMember: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
import { prisma } from '../lib/prisma';
import { projectMoneyDetail, projectMoneyOverview } from './project-money.service';

const d = (value: string) => new Prisma.Decimal(value);
const NOW = new Date('2026-10-28T09:00:00.000Z');

const projects = [
  {
    id: 'legacy',
    name: 'School system',
    status: 'COMPLETED',
    budget: d('5000'),
    clientId: 'c1',
    client: { companyName: 'MIMA' },
  },
  {
    id: 'new',
    name: 'Clinic app',
    status: 'ACTIVE',
    budget: null,
    clientId: null,
    client: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findMany).mockResolvedValue(projects as never);
  vi.mocked(prisma.invoice.findMany).mockResolvedValue([
    {
      id: 'i1',
      number: 'INV-1',
      projectId: 'legacy',
      status: 'PARTIAL',
      issueDate: new Date('2026-03-01T00:00:00.000Z'),
      dueDate: new Date('2026-04-01T00:00:00.000Z'),
      total: d('4000'),
      paidAmount: d('3000'),
    },
    {
      id: 'i2',
      number: 'INV-2',
      projectId: null,
      status: 'SENT',
      issueDate: new Date('2026-10-01T00:00:00.000Z'),
      dueDate: new Date('2026-11-30T00:00:00.000Z'),
      total: d('200'),
      paidAmount: d('0'),
    },
  ] as never);
  vi.mocked(prisma.payment.findMany).mockResolvedValue([
    {
      id: 'p1',
      invoiceId: 'i1',
      amount: d('3000'),
      method: 'EVC_PLUS',
      status: 'COMPLETED',
      reference: 'EVC-1',
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      invoice: { number: 'INV-1', projectId: 'legacy' },
    },
  ] as never);
  vi.mocked(prisma.projectExpense.findMany).mockResolvedValue([
    {
      id: 'e1',
      projectId: 'legacy',
      kind: 'ACTUAL',
      category: 'UI design',
      description: 'Screens',
      amount: d('1200'),
      expenseDate: new Date('2026-02-10T00:00:00.000Z'),
      createdAt: new Date('2026-02-10T00:00:00.000Z'),
    },
    {
      id: 'e2',
      projectId: 'legacy',
      kind: 'PLANNED',
      category: 'Backend',
      description: 'API build',
      amount: d('2500'),
      expenseDate: null,
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
    },
  ] as never);
  vi.mocked(prisma.financeTransaction.findMany).mockResolvedValue([
    {
      id: 't1',
      projectId: 'new',
      type: 'EXPENSE',
      status: 'POSTED',
      category: 'Hosting',
      description: 'VPS',
      amount: d('40'),
      currency: 'USD',
      occurredOn: new Date('2026-10-05T00:00:00.000Z'),
      counterparty: 'Contabo',
    },
  ] as never);
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{ projectId: 'legacy', minutes: 600n }] as never);
});

describe('projectMoneyOverview', () => {
  it('shows every project, including pre-ledger records, with company totals', async () => {
    const result = await projectMoneyOverview({ sort: 'outstanding', direction: 'desc' }, NOW);
    expect(result.projects.map((row) => row.projectId)).toEqual(['legacy', 'new']);
    const legacy = result.projects[0]!;
    expect(legacy).toMatchObject({
      clientName: 'MIMA',
      invoiced: '4000.00',
      collected: '3000.00',
      outstanding: '1000.00',
      overdue: '1000.00',
      spent: '1200.00',
      plannedCost: '2500.00',
      remainingBudget: '3800.00',
      cashProfit: '1800.00',
      hoursLogged: '10.0',
      health: 'ON_TRACK',
    });
    expect(result.projects[1]).toMatchObject({ spent: '40.00', health: 'NO_BUDGET' });
    expect(result.totals).toMatchObject({
      projectCount: 2,
      invoiced: '4200.00',
      outstanding: '1200.00',
      spent: '1240.00',
      unassigned: { invoiced: '200.00', collected: '0.00', outstanding: '200.00' },
    });
    expect(result.categories.map((row) => [row.category, row.spent])).toEqual([
      ['UI design', '1200.00'],
      ['Hosting', '40.00'],
      ['Backend', '0.00'],
    ]);
    expect(result.months).toHaveLength(12);
  });

  it('filters by search and health without changing company totals', async () => {
    const result = await projectMoneyOverview(
      { search: 'clinic', health: 'NO_BUDGET', sort: 'name', direction: 'asc' },
      NOW,
    );
    expect(result.projects.map((row) => row.projectId)).toEqual(['new']);
    expect(result.totals.projectCount).toBe(2);
  });
});

describe('projectMoneyDetail', () => {
  it('returns 404 for an unknown or deleted project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
    await expect(projectMoneyDetail('missing', NOW)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lists invoices, payments, spending, time and a lifetime timeline', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'legacy',
      name: 'School system',
      status: 'COMPLETED',
      budget: d('5000'),
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      dueDate: null,
      clientId: 'c1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      client: { companyName: 'MIMA' },
      manager: { name: 'Daacad' },
    } as never);
    vi.mocked(prisma.projectBudgetRevision.findMany).mockResolvedValue([]);
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([
      { userId: 'u1', role: 'ENGINEER', user: { name: 'Engineer' } },
    ] as never);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ userId: 'u1', name: 'Engineer', minutes: 600n }] as never)
      .mockResolvedValueOnce([{ phaseId: null, title: null, minutes: 600n }] as never);
    const result = await projectMoneyDetail('legacy', NOW);
    expect(result.figures.collected).toBe('3000.00');
    expect(result.invoices[0]).toMatchObject({ number: 'INV-1', outstanding: '1000.00' });
    expect(result.payments[0]).toMatchObject({ invoiceNumber: 'INV-1', amount: '3000.00' });
    expect(result.spending.map((row) => [row.id, row.countsAsSpent])).toEqual(
      expect.arrayContaining([
        ['e1', true],
        ['e2', false],
      ]),
    );
    expect(result.members).toEqual([{ userId: 'u1', name: 'Engineer', role: 'ENGINEER' }]);
    expect(result.hoursByPhase[0]).toMatchObject({ title: 'No phase', hours: '10.0' });
    expect(result.timeline[0]!.month).toBe('2026-01');
    expect(result.timeline.at(-1)).toMatchObject({
      month: '2026-10',
      cumulativeIn: '3000.00',
    });
  });
});
