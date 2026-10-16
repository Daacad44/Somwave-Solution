import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { assertBalanced } from './finance.service';

const amount = (value: string): Prisma.Decimal => new Prisma.Decimal(value);

describe('finance journal balance', () => {
  it('accepts exact decimal equality even for amounts unsafe as binary floats', () => {
    expect(() =>
      assertBalanced([
        { debit: amount('0.10'), credit: amount('0') },
        { debit: amount('0.20'), credit: amount('0') },
        { debit: amount('0'), credit: amount('0.30') },
      ]),
    ).not.toThrow();
  });

  it('rejects an unbalanced or one-sided journal', () => {
    expect(() =>
      assertBalanced([
        { debit: amount('10.00'), credit: amount('0') },
        { debit: amount('0'), credit: amount('9.99') },
      ]),
    ).toThrow('Debits and credits must balance');
    expect(() => assertBalanced([{ debit: amount('10'), credit: amount('0') }])).toThrow(
      'at least two lines',
    );
  });

  it('rejects mixed sides, negative amounts, and zero-only lines', () => {
    for (const invalid of [
      { debit: amount('1'), credit: amount('1') },
      { debit: amount('-1'), credit: amount('0') },
      { debit: amount('0'), credit: amount('0') },
    ]) {
      expect(() => assertBalanced([invalid, { debit: amount('0'), credit: amount('1') }])).toThrow(
        'one positive side',
      );
    }
  });
});
