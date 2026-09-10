// Website enquiries (SYSTEM_PROMPT §5). Creating an enquiry sends a message, so
// the handler is idempotent per Idempotency-Key (§10): the same key returns the
// same enquiry rather than creating a duplicate. Keys are held in Redis (best
// effort — if Redis is down the create still succeeds).
import type { CreateInquiryInput, AdminInquiry, InquiryStatus } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';

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

export async function listInquiries(): Promise<AdminInquiry[]> {
  const rows = await prisma.inquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
): Promise<AdminInquiry> {
  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Codsigan lama helin');
  const row = await prisma.inquiry.update({ where: { id }, data: { status } });
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
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
