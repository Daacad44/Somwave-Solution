// httpOnly auth cookies (SYSTEM_PROMPT §13: httpOnly + secure + sameSite=lax).
import type { CookieOptions, Request, Response } from 'express';
import { env } from './env';
import { ACCESS_TTL_MS, REFRESH_TTL_MS } from './tokens';

export const ACCESS_COOKIE = 'somwave_access';
export const REFRESH_COOKIE = 'somwave_refresh';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseOptions, maxAge: ACCESS_TTL_MS });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions, maxAge: REFRESH_TTL_MS });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions);
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}

export function readAccessCookie(req: Request): string | undefined {
  return req.cookies?.[ACCESS_COOKIE];
}

export function readRefreshCookie(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE];
}
