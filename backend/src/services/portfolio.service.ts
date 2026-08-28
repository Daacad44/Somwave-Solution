// Portfolio (SYSTEM_PROMPT §5). Public reads; the list is cached best-effort in
// Redis and falls through to Postgres on a miss/outage.
import type { PublicPortfolioItem, PublicPortfolioDetail } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const LIST_CACHE_KEY = 'public:portfolio';
const CACHE_TTL_SECONDS = 300;

export async function listPublishedPortfolio(): Promise<PublicPortfolioItem[]> {
  const cached = await safeGet(LIST_CACHE_KEY);
  if (cached) return JSON.parse(cached) as PublicPortfolioItem[];

  const items = await prisma.portfolioItem.findMany({
    where: { isPublished: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      client: true,
      coverImage: true,
      order: true,
    },
  });

  await safeSet(LIST_CACHE_KEY, JSON.stringify(items));
  return items;
}

export function getPortfolioBySlug(slug: string): Promise<PublicPortfolioDetail | null> {
  return prisma.portfolioItem.findFirst({
    where: { slug, isPublished: true },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      client: true,
      coverImage: true,
      order: true,
    },
  });
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
