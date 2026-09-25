import { describe, it, expect } from 'vitest';
import {
  confirmTwoFactorSchema,
  disableTwoFactorSchema,
  isTwoFactorRequired,
  loginSchema,
  updateProfileSchema,
} from './auth';

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });

  it('requires a non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('confirmTwoFactorSchema', () => {
  it('accepts a 6-digit code', () => {
    expect(confirmTwoFactorSchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it('rejects a short code', () => {
    expect(confirmTwoFactorSchema.safeParse({ code: '123' }).success).toBe(false);
  });
});

describe('isTwoFactorRequired', () => {
  it('is required for ADMIN and not for CLIENT', () => {
    expect(isTwoFactorRequired(['ADMIN'])).toBe(true);
    expect(isTwoFactorRequired(['CLIENT'])).toBe(false);
  });
});

describe('disableTwoFactorSchema', () => {
  it('accepts a TOTP or backup-sized code', () => {
    expect(disableTwoFactorSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(disableTwoFactorSchema.safeParse({ code: 'abcd1234' }).success).toBe(true);
  });
});

describe('updateProfileSchema', () => {
  it('requires a name', () => {
    expect(updateProfileSchema.safeParse({ name: 'Cali' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ name: '  ' }).success).toBe(false);
  });
});
