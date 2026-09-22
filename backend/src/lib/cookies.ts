// httpOnly auth cookies (SYSTEM_PROMPT §13: httpOnly + secure).
//
// Locally SameSite=Lax is correct: Vite and the API are same-site on localhost.
// Production dashboard login is a credentialed CORS fetch from
// https://app.somwave.botandev.com to https://api.somwave.botandev.com — different
// hosts, so it is cross-origin. Browsers will not persist SameSite=Lax cookies on
// that response; the POST /auth/login succeeds, then GET /auth/me has no cookie
// and the SPA bounces back to /login. SameSite=None; Secure is required there.
import type { CookieOptions, Request, Response } from 'express';
import { env, type Env } from './env';
import { ACCESS_TTL_MS, REFRESH_TTL_MS } from './tokens';

export const ACCESS_COOKIE = 'somwave_access';
export const REFRESH_COOKIE = 'somwave_refresh';

export function authCookieBaseOptions(nodeEnv: Env['NODE_ENV'] = env.NODE_ENV): CookieOptions {
  const isProd = nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };
}

const baseOptions: CookieOptions = authCookieBaseOptions();

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
