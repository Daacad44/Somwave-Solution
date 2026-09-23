import { describe, expect, it } from 'vitest';
import { chargeEvcPaymentSchema, evcPhoneSchema } from './payment';

describe('evcPhoneSchema', () => {
  it('accepts common Somali mobile formats', () => {
    expect(evcPhoneSchema.safeParse('+252612345678').success).toBe(true);
    expect(evcPhoneSchema.safeParse('252612345678').success).toBe(true);
    expect(evcPhoneSchema.safeParse('0612345678').success).toBe(true);
  });

  it('rejects invalid numbers', () => {
    expect(evcPhoneSchema.safeParse('123').success).toBe(false);
  });
});

describe('chargeEvcPaymentSchema', () => {
  it('requires invoice, amount, and phone', () => {
    const parsed = chargeEvcPaymentSchema.safeParse({
      invoiceId: 'inv_1',
      amount: '10.00',
      phone: '+252612345678',
    });
    expect(parsed.success).toBe(true);
  });
});
