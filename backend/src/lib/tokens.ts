// Token utilities (SYSTEM_PROMPT §13). Access = short-lived JWT (15m). Refresh =
// opaque random string, 30d, stored only as a SHA-256 hash and rotated on use.
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from './env';

const ACCESS_TTL = '15m';
export const REFRESH_TTL_DAYS = 30;
export const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
export const ACCESS_TTL_MS = 15 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, { subject: userId, expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string' || !decoded.sub) {
    throw new Error('Malformed access token');
  }
  return { sub: decoded.sub };
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiryDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + REFRESH_TTL_MS);
}
