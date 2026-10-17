import { describe, expect, it } from 'vitest';
import {
  createFinanceTransactionSchema,
  financeBusinessDate,
  parseFinanceBusinessDate,
} from './finance';

const valid = {
  type: 'EXPENSE',
  amount: '100.20',
  currency: 'USD',
  category: 'Hosting',
  description: 'Server invoice payment',
  occurredOn: '2026-10-16T00:00:00.000Z',
  cashAccountId: 'cash',
  offsetAccountId: 'hosting',
};

describe('finance transaction validation', () => {
  it('accepts a two-decimal positive amount', () => {
    expect(createFinanceTransactionSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects invalid precision, zero, and non-ISO currency', () => {
    for (const amount of ['0', '0.00', '-1', '1.001', '1e3']) {
      expect(createFinanceTransactionSchema.safeParse({ ...valid, amount }).success).toBe(false);
    }
    expect(createFinanceTransactionSchema.safeParse({ ...valid, currency: 'usd' }).success).toBe(
      false,
    );
  });
});

describe('Mogadishu finance date boundaries', () => {
  it('rolls a UTC evening into the following local month', () => {
    expect(financeBusinessDate(new Date('2026-12-31T21:00:00Z'))).toBe('2027-01-01');
    expect(parseFinanceBusinessDate('2027-01-01')?.toISOString()).toBe('2026-12-31T21:00:00.000Z');
  });
  it('rejects impossible dates and accepts leap days', () => {
    expect(parseFinanceBusinessDate('2026-02-29')).toBeNull();
    expect(parseFinanceBusinessDate('2028-02-29')?.toISOString()).toBe('2028-02-28T21:00:00.000Z');
  });
});
