import { describe, it, expect } from 'vitest';
import { createInquirySchema } from './inquiry';

describe('createInquirySchema', () => {
  it('accepts a valid enquiry', () => {
    const parsed = createInquirySchema.safeParse({
      name: 'Cali Axmed',
      email: 'cali@example.com',
      message: 'Waxaan rabaa website cusub oo ganacsigayga u ah.',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a bad email and a too-short message', () => {
    expect(
      createInquirySchema.safeParse({ name: 'A', email: 'nope', message: 'short' }).success,
    ).toBe(false);
  });

  it('trims and allows an optional phone', () => {
    const parsed = createInquirySchema.parse({
      name: '  Cali  ',
      email: 'cali@example.com',
      phone: '+252 61 000 0000',
      message: 'Fariin dheer oo ku filan si ay u ansaxdo.',
    });
    expect(parsed.name).toBe('Cali');
    expect(parsed.phone).toBe('+252 61 000 0000');
  });
});
