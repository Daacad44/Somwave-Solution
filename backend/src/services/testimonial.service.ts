// Testimonials (W5.1, §5: only services touch Prisma). Public reads are cached
// best-effort in Redis; CMS writes (content.*) invalidate the cache so the site
// reflects them.
import type {
  PublicTestimonial,
  AdminTestimonial,
  CreateTestimonialInput,
  UpdateTestimonialInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';

const CACHE_KEY = 'public:testimonials';
const CACHE_TTL_SECONDS = 300;

export async function listPublishedTestimonials(): Promise<PublicTestimonial[]> {
  const cached = await safeGet(CACHE_KEY);
  if (cached) return JSON.parse(cached) as PublicTestimonial[];

  const rows = await prisma.testimonial.findMany({
    where: { isPublished: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      author: true,
      role: true,
      company: true,
      quote: true,
      avatarUrl: true,
      rating: true,
    },
  });

  await safeSet(CACHE_KEY, JSON.stringify(rows));
  return rows;
}

// ── CMS (W5.1) — the admin view sees unpublished testimonials too ─────────────

const adminSelect = {
  id: true,
  author: true,
  role: true,
  company: true,
  quote: true,
  avatarUrl: true,
  rating: true,
  order: true,
  isPublished: true,
  createdAt: true,
} as const;

type TestimonialRow = {
  id: string;
  author: string;
  role: string | null;
  company: string | null;
  quote: string;
  avatarUrl: string | null;
  rating: number | null;
  order: number;
  isPublished: boolean;
  createdAt: Date;
};

function toAdmin(row: TestimonialRow): AdminTestimonial {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listAllTestimonials(): Promise<AdminTestimonial[]> {
  const rows = await prisma.testimonial.findMany({
    orderBy: { order: 'asc' },
    select: adminSelect,
  });
  return rows.map(toAdmin);
}

export async function createTestimonial(input: CreateTestimonialInput): Promise<AdminTestimonial> {
  const row = await prisma.testimonial.create({
    data: {
      author: input.author,
      role: input.role ?? null,
      company: input.company ?? null,
      quote: input.quote,
      avatarUrl: input.avatarUrl ?? null,
      rating: input.rating ?? null,
      order: input.order,
      isPublished: input.isPublished,
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

export async function updateTestimonial(
  id: string,
  input: UpdateTestimonialInput,
): Promise<AdminTestimonial> {
  const testimonial = await prisma.testimonial.findUnique({ where: { id } });
  if (!testimonial) throw new AppError('NOT_FOUND', 404, 'Marag-furkan lama helin');

  const row = await prisma.testimonial.update({
    where: { id },
    data: {
      ...(input.author !== undefined ? { author: input.author } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.company !== undefined ? { company: input.company } : {}),
      ...(input.quote !== undefined ? { quote: input.quote } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

export async function deleteTestimonial(id: string): Promise<void> {
  const testimonial = await prisma.testimonial.findUnique({ where: { id } });
  if (!testimonial) throw new AppError('NOT_FOUND', 404, 'Marag-furkan lama helin');
  await prisma.testimonial.delete({ where: { id } });
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
