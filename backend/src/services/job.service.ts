// Careers (SYSTEM_PROMPT §5). Published openings are Redis-cached best-effort;
// applications are created idempotently (§10) and feed Internal recruitment (I3.5).
import type {
  CreateJobApplicationInput,
  PublicJobOpeningSummary,
  PublicJobOpeningDetail,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';

const LIST_CACHE_KEY = 'public:careers';
const CACHE_TTL_SECONDS = 300;
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

export async function listPublishedOpenings(): Promise<PublicJobOpeningSummary[]> {
  const cached = await safeGet(LIST_CACHE_KEY);
  if (cached) return JSON.parse(cached) as PublicJobOpeningSummary[];

  const openings = await prisma.jobOpening.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      location: true,
      employmentType: true,
      summary: true,
    },
  });

  await safeSet(LIST_CACHE_KEY, JSON.stringify(openings), CACHE_TTL_SECONDS);
  return openings;
}

export function getOpeningBySlug(slug: string): Promise<PublicJobOpeningDetail | null> {
  return prisma.jobOpening.findFirst({
    where: { slug, isPublished: true },
    select: {
      id: true,
      slug: true,
      title: true,
      location: true,
      employmentType: true,
      summary: true,
      description: true,
    },
  });
}

export async function applyToOpening(
  slug: string,
  input: CreateJobApplicationInput,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const opening = await prisma.jobOpening.findFirst({
    where: { slug, isPublished: true },
    select: { id: true },
  });
  if (!opening) throw new AppError('NOT_FOUND', 404, 'Fursaddan shaqo lama helin');

  const cacheKey = `idem:application:${idempotencyKey}`;
  const existingId = await safeGet(cacheKey);
  if (existingId) return { id: existingId };

  const application = await prisma.jobApplication.create({
    data: {
      jobOpeningId: opening.id,
      name: input.name,
      email: input.email,
      phone: input.phone && input.phone.length > 0 ? input.phone : null,
      coverLetter: input.coverLetter && input.coverLetter.length > 0 ? input.coverLetter : null,
      resumeUrl: input.resumeUrl ?? null,
    },
    select: { id: true },
  });

  await safeSet(cacheKey, application.id, IDEMPOTENCY_TTL_SECONDS);
  return application;
}

async function safeGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string, ttl: number): Promise<void> {
  try {
    await redis.set(key, value, 'EX', ttl);
  } catch {
    // Best-effort.
  }
}
