// Portfolio (SYSTEM_PROMPT §5). Public reads; the list is cached best-effort in
// Redis and falls through to Postgres on a miss/outage. CMS writes (W4.3)
// invalidate the cache so the public site reflects them.
import type {
  PublicPortfolioItem,
  PublicPortfolioDetail,
  AdminPortfolioItem,
  CreatePortfolioItemInput,
  UpdatePortfolioItemInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';

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

// ── CMS (W4.3) — the admin view sees unpublished items too ────────────────────

const adminSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  description: true,
  client: true,
  coverImage: true,
  order: true,
  isPublished: true,
  publishedAt: true,
  createdAt: true,
} as const;

type PortfolioRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  client: string | null;
  coverImage: string | null;
  order: number;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
};

function toAdmin(row: PortfolioRow): AdminPortfolioItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    client: row.client,
    coverImage: row.coverImage,
    order: row.order,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAllPortfolio(): Promise<AdminPortfolioItem[]> {
  const rows = await prisma.portfolioItem.findMany({
    orderBy: { order: 'asc' },
    select: adminSelect,
  });
  return rows.map(toAdmin);
}

export async function createPortfolioItem(
  input: CreatePortfolioItemInput,
): Promise<AdminPortfolioItem> {
  const existing = await prisma.portfolioItem.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError('CONFLICT', 409, 'Slug-kan horey ayaa loo isticmaalay');

  const row = await prisma.portfolioItem.create({
    data: {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      description: input.description ?? null,
      client: input.client ?? null,
      coverImage: input.coverImage ?? null,
      order: input.order,
      isPublished: input.isPublished,
      publishedAt: input.isPublished ? new Date() : null,
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

export async function updatePortfolioItem(
  id: string,
  input: UpdatePortfolioItemInput,
): Promise<AdminPortfolioItem> {
  const item = await prisma.portfolioItem.findUnique({ where: { id } });
  if (!item) throw new AppError('NOT_FOUND', 404, 'Shaqadan lama helin');

  if (input.slug && input.slug !== item.slug) {
    const clash = await prisma.portfolioItem.findUnique({ where: { slug: input.slug } });
    if (clash) throw new AppError('CONFLICT', 409, 'Slug-kan horey ayaa loo isticmaalay');
  }

  const publishing = input.isPublished === true && !item.isPublished;

  const row = await prisma.portfolioItem.update({
    where: { id },
    data: {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.client !== undefined ? { client: input.client } : {}),
      ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(publishing && !item.publishedAt ? { publishedAt: new Date() } : {}),
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

export async function deletePortfolioItem(id: string): Promise<void> {
  const item = await prisma.portfolioItem.findUnique({ where: { id } });
  if (!item) throw new AppError('NOT_FOUND', 404, 'Shaqadan lama helin');
  await prisma.portfolioItem.delete({ where: { id } });
  await invalidateCache();
}

async function invalidateCache(): Promise<void> {
  try {
    await redis.del(LIST_CACHE_KEY);
  } catch {
    // Best-effort; the TTL will refresh it anyway.
  }
}
