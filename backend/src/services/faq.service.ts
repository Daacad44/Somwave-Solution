// FAQ (W5.3, §5: only services touch Prisma). Public reads are cached best-effort
// in Redis; CMS writes (content.*) invalidate the cache.
import type { PublicFaq, AdminFaq, CreateFaqInput, UpdateFaqInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';

const CACHE_KEY = 'public:faqs';
const CACHE_TTL_SECONDS = 300;

export async function listPublishedFaqs(): Promise<PublicFaq[]> {
  const cached = await safeGet(CACHE_KEY);
  if (cached) return JSON.parse(cached) as PublicFaq[];

  const rows = await prisma.faq.findMany({
    where: { isPublished: true },
    orderBy: { order: 'asc' },
    select: { id: true, question: true, answer: true },
  });

  await safeSet(CACHE_KEY, JSON.stringify(rows));
  return rows;
}

// ── CMS (W5.3) — the admin view sees unpublished FAQs too ─────────────────────

const adminSelect = {
  id: true,
  question: true,
  answer: true,
  order: true,
  isPublished: true,
  createdAt: true,
} as const;

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  order: number;
  isPublished: boolean;
  createdAt: Date;
};

function toAdmin(row: FaqRow): AdminFaq {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listAllFaqs(): Promise<AdminFaq[]> {
  const rows = await prisma.faq.findMany({ orderBy: { order: 'asc' }, select: adminSelect });
  return rows.map(toAdmin);
}

export async function createFaq(input: CreateFaqInput): Promise<AdminFaq> {
  const row = await prisma.faq.create({
    data: {
      question: input.question,
      answer: input.answer,
      order: input.order,
      isPublished: input.isPublished,
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

export async function updateFaq(id: string, input: UpdateFaqInput): Promise<AdminFaq> {
  const faq = await prisma.faq.findUnique({ where: { id } });
  if (!faq) throw new AppError('NOT_FOUND', 404, 'Su’aashan lama helin');

  const row = await prisma.faq.update({
    where: { id },
    data: {
      ...(input.question !== undefined ? { question: input.question } : {}),
      ...(input.answer !== undefined ? { answer: input.answer } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

export async function deleteFaq(id: string): Promise<void> {
  const faq = await prisma.faq.findUnique({ where: { id } });
  if (!faq) throw new AppError('NOT_FOUND', 404, 'Su’aashan lama helin');
  await prisma.faq.delete({ where: { id } });
  await invalidateCache();
}

async function invalidateCache(): Promise<void> {
  try {
    await redis.del(CACHE_KEY);
  } catch {
    // Best-effort; the TTL will refresh it anyway.
  }
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
    await redis.set(key, value, 'EX', CACHE_TTL_SECONDS);
  } catch {
    // Best-effort cache.
  }
}
