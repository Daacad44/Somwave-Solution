import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiryDate,
  REFRESH_TTL_MS,
} from './tokens';

describe('access tokens', () => {
  it('signs a token carrying the user id and verifies it', () => {
    const token = signAccessToken('user_123');
    expect(verifyAccessToken(token).sub).toBe('user_123');
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken('user_123');
    expect(() => verifyAccessToken(`${token}x`)).toThrow();
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
