// CORS allow-list helpers (SYSTEM_PROMPT §13). Never "*": this API uses
// credentialed cookies, so the reflected Origin must be an exact match.
import type { CorsOptions } from 'cors';

export const CORS_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

// Browser preflight Access-Control-Request-Headers plus Idempotency-Key (§10).
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Origin',
  'Idempotency-Key',
] as const;

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map(normalizeOrigin)
    .filter((origin) => origin.length > 0 && origin !== '*');
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowlist: readonly string[],
): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return allowlist.some((allowed) => allowed === normalized);
}

export function buildCorsOptions(allowlist: readonly string[]): CorsOptions {
  const allowed = allowlist.map(normalizeOrigin).filter(Boolean);

  return {
    origin(origin, callback) {
      // Non-browser clients (curl, Coolify health) send no Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, isAllowedCorsOrigin(origin, allowed));
    },
    credentials: true,
    methods: [...CORS_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    optionsSuccessStatus: 204,
    maxAge: 600,
    preflightContinue: false,
  };
}
