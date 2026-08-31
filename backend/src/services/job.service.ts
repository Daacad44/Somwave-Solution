// Careers (SYSTEM_PROMPT §5). Published openings are Redis-cached best-effort;
// applications are created idempotently (§10) and feed Internal recruitment (I3.5).
import type {
  CreateJobApplicationInput,
  PublicJobOpeningSummary,
  PublicJobOpeningDetail,
  AdminJobOpening,
  CreateJobOpeningInput,
  UpdateJobOpeningInput,
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

// ── CMS (W4.4) — manage openings, incl. unpublished ───────────────────────────

const adminSelect = {
  id: true,
  slug: true,
  title: true,
  location: true,
  employmentType: true,
  summary: true,
  description: true,
  isPublished: true,
  publishedAt: true,
  createdAt: true,
  _count: { select: { applications: true } },
} as const;

type OpeningRow = {
  id: string;
  slug: string;
  title: string;
  location: string;
  employmentType: AdminJobOpening['employmentType'];
  summary: string;
  description: string;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  _count: { applications: number };
};

function toAdmin(row: OpeningRow): AdminJobOpening {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    location: row.location,
    employmentType: row.employmentType,
    summary: row.summary,
    description: row.description,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    applicationCount: row._count.applications,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAllOpenings(): Promise<AdminJobOpening[]> {
  const rows = await prisma.jobOpening.findMany({
    orderBy: { createdAt: 'desc' },
    select: adminSelect,
  });
  return rows.map(toAdmin);
}

export async function createOpening(input: CreateJobOpeningInput): Promise<AdminJobOpening> {
  const existing = await prisma.jobOpening.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError('CONFLICT', 409, 'Slug-kan horey ayaa loo isticmaalay');

  const row = await prisma.jobOpening.create({
    data: {
      slug: input.slug,
      title: input.title,
      location: input.location,
      employmentType: input.employmentType,
      summary: input.summary,
      description: input.description,
      isPublished: input.isPublished,
      publishedAt: input.isPublished ? new Date() : null,
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

export async function updateOpening(
  id: string,
  input: UpdateJobOpeningInput,
): Promise<AdminJobOpening> {
  const opening = await prisma.jobOpening.findUnique({ where: { id } });
  if (!opening) throw new AppError('NOT_FOUND', 404, 'Fursaddan shaqo lama helin');

  if (input.slug && input.slug !== opening.slug) {
    const clash = await prisma.jobOpening.findUnique({ where: { slug: input.slug } });
    if (clash) throw new AppError('CONFLICT', 409, 'Slug-kan horey ayaa loo isticmaalay');
  }

  const publishing = input.isPublished === true && !opening.isPublished;

  const row = await prisma.jobOpening.update({
    where: { id },
    data: {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(publishing && !opening.publishedAt ? { publishedAt: new Date() } : {}),
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

// An opening with applications is never hard-deleted (that would cascade the
// application records, §7); unpublish it instead.
export async function deleteOpening(id: string): Promise<void> {
  const opening = await prisma.jobOpening.findUnique({
    where: { id },
    select: { id: true, _count: { select: { applications: true } } },
  });
  if (!opening) throw new AppError('NOT_FOUND', 404, 'Fursaddan shaqo lama helin');
  if (opening._count.applications > 0) {
    throw new AppError(
      'CONFLICT',
      409,
      'Fursaddan waxay leedahay codsiyo — halkii la tirtiro, ka saar daabacaadda',
    );
  }
  await prisma.jobOpening.delete({ where: { id } });
  await invalidateCache();
}

async function invalidateCache(): Promise<void> {
  try {
    await redis.del(LIST_CACHE_KEY);
  } catch {
    // Best-effort; the TTL will refresh it anyway.
  }
}
