import { describe, expect, it } from 'vitest';
import { newPasswordSchema, passwordPolicyStatus } from './password';

describe('new password policy', () => {
  it('accepts strong passwords of exactly 12 and up to 128 characters', () => {
    expect(newPasswordSchema.safeParse('Abcdefg!1234').success).toBe(true);
    expect(newPasswordSchema.safeParse(`Aa1!${'x'.repeat(124)}`).success).toBe(true);
  });

  it.each([
    ['short', 'Abc!123'],
    ['over 128', `Aa1!${'x'.repeat(125)}`],
    ['missing uppercase', 'abcdefg!12345'],
    ['missing lowercase', 'ABCDEFG!12345'],
    ['missing number', 'Abcdefghijk!'],
    ['missing special', 'Abcdefgh1234'],
    ['common', 'Password123!'],
  ])('rejects %s passwords', (_case, password) => {
    expect(newPasswordSchema.safeParse(password).success).toBe(false);
  });

  it('rejects obvious account-identifying words', () => {
    expect(
      passwordPolicyStatus('Ayaan!Mosaic27', {
        name: 'Ayaan Ali',
        email: 'ayaan@example.com',
      }).private,
    ).toBe(false);
    expect(
      passwordPolicyStatus('Mosaic!7River8', {
        name: 'Ayaan Ali',
        email: 'ayaan@example.com',
      }).private,
    ).toBe(true);
  });
});
