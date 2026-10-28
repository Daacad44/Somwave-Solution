import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  ageing,
  computeFigures,
  findDuplicates,
  health,
  lastMonths,
  monthlySeries,
  serializeFigures,
  type MoneyExpense,
  type MoneyInvoice,
  type MoneyPayment,
  type MoneyTransaction,
} from './project-money.calc';

const d = (value: string) => new Prisma.Decimal(value);
const NOW = new Date('2026-10-28T09:00:00.000Z');

function invoice(overrides: Partial<MoneyInvoice>): MoneyInvoice {
  return {
    id: 'inv',
    number: 'INV-1',
    projectId: 'p1',
    status: 'SENT',
    issueDate: new Date('2026-09-01T00:00:00.000Z'),
    dueDate: new Date('2026-12-01T00:00:00.000Z'),
    total: d('1000'),
    paidAmount: d('0'),
    ...overrides,
  };
}
function payment(overrides: Partial<MoneyPayment>): MoneyPayment {
  return {
    id: 'pay',
    invoiceId: 'inv',
    invoiceNumber: 'INV-1',
    projectId: 'p1',
    amount: d('400'),
    method: 'EVC_PLUS',
    status: 'COMPLETED',
    reference: null,
    date: new Date('2026-09-15T10:00:00.000Z'),
    ...overrides,
  };
}
function expense(overrides: Partial<MoneyExpense>): MoneyExpense {
  return {
    id: 'exp',
    projectId: 'p1',
    kind: 'ACTUAL',
    category: 'UI design',
    description: 'Figma screens',
    amount: d('300'),
    date: new Date('2026-09-10T00:00:00.000Z'),
    ...overrides,
  };
}
function tx(overrides: Partial<MoneyTransaction>): MoneyTransaction {
  return {
    id: 'tx',
    projectId: 'p1',
    type: 'EXPENSE',
    status: 'POSTED',
    category: 'Hosting',
    description: 'VPS',
    amount: d('50'),
    currency: 'USD',
    date: new Date('2026-10-02T00:00:00.000Z'),
    counterparty: null,
    ...overrides,
  };
}

const base = { budget: d('2000'), minutes: 90, currency: 'USD', now: NOW };

describe('project money figures', () => {
  it('derives billed, collected, outstanding, spent and profit from source records', () => {
    const figures = computeFigures({
      ...base,
      invoices: [
        invoice({ id: 'a', total: d('1000'), paidAmount: d('400') }),
        invoice({ id: 'b', status: 'DRAFT', total: d('700') }),
        invoice({ id: 'c', status: 'VOID', total: d('900') }),
      ],
      payments: [payment({}), payment({ id: 'failed', status: 'FAILED', amount: d('999') })],
      expenses: [expense({}), expense({ id: 'plan', kind: 'PLANNED', amount: d('1200') })],
      transactions: [
        tx({}),
        tx({ id: 'pending', status: 'SUBMITTED', amount: d('80') }),
        tx({ id: 'income', type: 'INCOME', amount: d('100') }),
        tx({ id: 'sos', currency: 'SOS', amount: d('500000') }),
      ],
    });
    const out = serializeFigures(figures);
    expect(out).toMatchObject({
      budget: '2000.00',
      plannedCost: '1200.00',
      invoiced: '1000.00',
      draftInvoiced: '700.00',
      collected: '500.00',
      outstanding: '600.00',
      overdue: '0.00',
      spent: '350.00',
      pendingSpend: '80.00',
      remainingBudget: '1650.00',
      cashProfit: '150.00',
      billedProfit: '650.00',
      marginPercent: '65.0',
      budgetUsedPercent: '17.5',
      collectionPercent: '50.0',
      hoursLogged: '1.5',
    });
  });

  it('treats an unpaid balance past its due date as overdue', () => {
    const figures = computeFigures({
      ...base,
      invoices: [invoice({ dueDate: new Date('2026-10-01T00:00:00.000Z'), paidAmount: d('250') })],
      payments: [],
      expenses: [],
      transactions: [],
    });
    expect(figures.overdue.toFixed(2)).toBe('750.00');
    expect(figures.overdueInvoiceCount).toBe(1);
  });

  it('returns null percentages when there is no budget or invoice', () => {
    const out = serializeFigures(
      computeFigures({
        ...base,
        budget: null,
        invoices: [],
        payments: [],
        expenses: [],
        transactions: [],
      }),
    );
    expect(out.budgetUsedPercent).toBeNull();
    expect(out.marginPercent).toBeNull();
    expect(out.remainingBudget).toBeNull();
  });
});

describe('health', () => {
  it('classifies budget use', () => {
    expect(health(d('10'), null)).toBe('NO_BUDGET');
    expect(health(d('79'), d('100'))).toBe('ON_TRACK');
    expect(health(d('80'), d('100'))).toBe('AT_RISK');
    expect(health(d('100.01'), d('100'))).toBe('OVER_BUDGET');
  });
});

describe('duplicates', () => {
  it('flags a posted expense matching an actual project expense within three days', () => {
    const result = findDuplicates(
      [expense({ id: 'e1', amount: d('50'), date: new Date('2026-10-01T00:00:00.000Z') })],
      [tx({ id: 't1' }), tx({ id: 't2' })],
    );
    expect([...result.entries()]).toEqual([['t1', 'e1']]);
  });

  it('ignores different projects, amounts and far dates', () => {
    const result = findDuplicates(
      [expense({ id: 'e1', amount: d('50'), date: new Date('2026-09-01T00:00:00.000Z') })],
      [tx({ id: 't1' }), tx({ id: 't2', projectId: 'p2' }), tx({ id: 't3', amount: d('51') })],
    );
    expect(result.size).toBe(0);
  });
});

describe('ageing and months', () => {
  it('buckets open balances by days overdue', () => {
    const result = ageing(
      [
        invoice({ id: 'cur' }),
        invoice({ id: 'd10', dueDate: new Date('2026-10-18T00:00:00.000Z') }),
        invoice({ id: 'd45', dueDate: new Date('2026-09-13T00:00:00.000Z') }),
        invoice({
          id: 'd120',
          dueDate: new Date('2026-06-30T00:00:00.000Z'),
          paidAmount: d('900'),
        }),
        invoice({ id: 'paid', status: 'PAID', paidAmount: d('1000') }),
      ],
      NOW,
    );
    expect(result).toEqual({
      current: '1000.00',
      days1to30: '1000.00',
      days31to60: '1000.00',
      days61to90: '0.00',
      days90plus: '100.00',
    });
  });

  it('builds a 12-month window ending in the current business month', () => {
    const months = lastMonths(NOW, 12);
    expect(months[0]).toBe('2025-11');
    expect(months[11]).toBe('2026-10');
  });

  it('places money in and out in the month it happened (UTC+3)', () => {
    const rows = monthlySeries(
      {
        invoices: [invoice({})],
        payments: [payment({ date: new Date('2026-09-30T22:00:00.000Z') })],
        expenses: [expense({}), expense({ id: 'plan', kind: 'PLANNED' })],
        transactions: [tx({})],
        currency: 'USD',
      },
      ['2026-09', '2026-10'],
    );
    expect(rows).toEqual([
      { month: '2026-09', moneyIn: '0.00', moneyOut: '300.00', invoiced: '1000.00' },
      { month: '2026-10', moneyIn: '400.00', moneyOut: '50.00', invoiced: '0.00' },
    ]);
  });
});
