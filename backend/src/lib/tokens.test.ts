import { describe, it, expect } from 'vitest';
import { generate } from 'otplib';
import {
  signAccessToken,
  verifyAccessToken,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiryDate,
  REFRESH_TTL_MS,
} from './tokens';
import { createTotpSecret, verifyTotp } from './totp';

describe('access tokens', () => {
  it('signs a token carrying the user id and verifies it', () => {
    const token = signAccessToken('user_123');
    expect(verifyAccessToken(token).sub).toBe('user_123');
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken('user_123');
    expect(() => verifyAccessToken(`${token}x`)).toThrow();
  });

  it('rejects a 2FA challenge as an access token', () => {
    const token = signTwoFactorChallenge('user_123');
    expect(() => verifyAccessToken(token)).toThrow();
  });
});

describe('2FA challenge tokens', () => {
  it('round-trips the user id', () => {
    const token = signTwoFactorChallenge('user_123');
    expect(verifyTwoFactorChallenge(token).sub).toBe('user_123');
  });

  it('rejects an access token as a challenge', () => {
    const token = signAccessToken('user_123');
    expect(() => verifyTwoFactorChallenge(token)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('generates unique tokens', () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it('hashes deterministically to a 64-char hex digest', () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('computes an expiry 30 days out', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(refreshExpiryDate(now).getTime()).toBe(now.getTime() + REFRESH_TTL_MS);
  });
});

describe('totp', () => {
  it('accepts a live code and rejects a wrong one', async () => {
    const secret = createTotpSecret();
    const token = await generate({ secret });
    expect(await verifyTotp(secret, token)).toBe(true);
    expect(await verifyTotp(secret, '000000')).toBe(false);
  });
});
