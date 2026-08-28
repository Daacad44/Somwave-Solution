// Website enquiries (SYSTEM_PROMPT §5). Creating an enquiry sends a message, so
// the handler is idempotent per Idempotency-Key (§10): the same key returns the
// same enquiry rather than creating a duplicate. Keys are held in Redis (best
// effort — if Redis is down the create still succeeds).
import type { CreateInquiryInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24h

export async function createInquiry(
  input: CreateInquiryInput,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const cacheKey = `idem:inquiry:${idempotencyKey}`;

  const existingId = await safeGet(cacheKey);
  if (existingId) return { id: existingId };

  const inquiry = await prisma.inquiry.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone && input.phone.length > 0 ? input.phone : null,
      message: input.message,
    },
    select: { id: true },
  });

  await safeSet(cacheKey, inquiry.id);
  return inquiry;
}

async function safeGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await redis.set(key, value, 'EX', IDEMPOTENCY_TTL_SECONDS);
  } catch {
    // Best-effort idempotency; ignore write failures.
  }
}
