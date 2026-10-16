import { describe, expect, it } from 'vitest';
import { createFinanceTransactionSchema } from './finance';

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
