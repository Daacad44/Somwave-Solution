import { describe, it, expect } from 'vitest';
import { createInvoiceSchema } from './invoice';

const base = {
  clientId: 'cl_1',
  issueDate: '2026-09-01',
  dueDate: '2026-09-15',
  items: [{ description: 'Web', quantity: '2', unitPrice: '15.00' }],
};

describe('createInvoiceSchema', () => {
  it('defaults tax and discount to 0', () => {
    const parsed = createInvoiceSchema.parse(base);
    expect(parsed.tax).toBe('0');
    expect(parsed.discount).toBe('0');
  });

  it('accepts tax and discount money strings', () => {
    const parsed = createInvoiceSchema.parse({ ...base, tax: '2.50', discount: '1.00' });
    expect(parsed.tax).toBe('2.50');
    expect(parsed.discount).toBe('1.00');
  });

  it('rejects invalid money', () => {
    expect(createInvoiceSchema.safeParse({ ...base, tax: 'abc' }).success).toBe(false);
  });
});
