// Idempotency-Key handling (SYSTEM_PROMPT §10). Anything that sends a message
// or charges money must carry the header; the handler replays the stored result
// for the same actor+scope+key. Redis is the store; a Redis outage does not
// bypass the header requirement, and the mutation itself must still be safe
// to retry (e.g. DRAFT→SENT is one-way).
import { redis } from './redis';
import { AppError } from './http';

const KEY_PATTERN = /^[\w.:-]{8,128}$/;
const TTL_SECONDS = 24 * 60 * 60;

export function readIdempotencyKey(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !KEY_PATTERN.test(value)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Idempotency-Key waa waajib');
  }
  return value;
}

export async function replayIdempotent<T>(cacheKey: string): Promise<T | null> {
  try {
    const cached = await redis.get(cacheKey);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

export async function storeIdempotent<T>(cacheKey: string, value: T): Promise<void> {
  try {
    await redis.set(cacheKey, JSON.stringify(value), 'EX', TTL_SECONDS);
  } catch {
    // Cache write is best-effort; the underlying mutation remains idempotent.
  }
}

export function idempotencyCacheKey(scope: string, actorId: string, key: string): string {
  return `idempotency:${scope}:${actorId}:${key}`;
}
