// Portfolio (SYSTEM_PROMPT §5). Public reads; the list is cached best-effort in
// Redis and falls through to Postgres on a miss/outage. CMS writes (W4.3)
// invalidate the cache so the public site reflects them.
import type {
  PublicPortfolioItem,
  PublicPortfolioDetail,
  AdminPortfolioItem,
  PortfolioCategory,
  CreatePortfolioItemInput,
  UpdatePortfolioItemInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';

const LIST_CACHE_KEY = 'public:portfolio:v3';
const CACHE_TTL_SECONDS = 300;

export async function listPublishedPortfolio(): Promise<PublicPortfolioItem[]> {
  const cached = await safeGet(LIST_CACHE_KEY);
  if (cached) return JSON.parse(cached) as PublicPortfolioItem[];

  const items = await prisma.portfolioItem.findMany({
    where: { isPublished: true, isArchived: false },
    orderBy: [{ featured: 'desc' }, { order: 'asc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      client: true,
      category: true,
      coverImage: true,
      order: true,
      featured: true,
    },
  });

  await safeSet(LIST_CACHE_KEY, JSON.stringify(items));
  return items;
}

export async function getPortfolioBySlug(slug: string): Promise<PublicPortfolioDetail | null> {
  const item = await prisma.portfolioItem.findFirst({
    where: { slug, isPublished: true, isArchived: false },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      client: true,
      category: true,
      coverImage: true,
      order: true,
      featured: true,
      technologies: true,
      galleryImages: true,
      features: true,
      completionDate: true,
      projectStatus: true,
      liveDemoUrl: true,
      caseStudyUrl: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
  return item
    ? { ...item, completionDate: item.completionDate?.toISOString().slice(0, 10) ?? null }
    : null;
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
  category: true,
  coverImage: true,
  order: true,
  technologies: true,
  galleryImages: true,
  features: true,
  completionDate: true,
  projectStatus: true,
  liveDemoUrl: true,
  caseStudyUrl: true,
  featured: true,
  demoClicks: true,
  isArchived: true,
  seoTitle: true,
  seoDescription: true,
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
  category: PortfolioCategory | null;
  coverImage: string | null;
  order: number;
  technologies: string[];
  galleryImages: string[];
  features: string[];
  completionDate: Date | null;
  projectStatus: string | null;
  liveDemoUrl: string | null;
  caseStudyUrl: string | null;
  featured: boolean;
  demoClicks: number;
  isArchived: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
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
    category: row.category,
    coverImage: row.coverImage,
    order: row.order,
    technologies: row.technologies,
    galleryImages: row.galleryImages,
    features: row.features,
    completionDate: row.completionDate?.toISOString().slice(0, 10) ?? null,
    projectStatus: row.projectStatus,
    liveDemoUrl: row.liveDemoUrl,
    caseStudyUrl: row.caseStudyUrl,
    featured: row.featured,
    demoClicks: row.demoClicks,
    isArchived: row.isArchived,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
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
  if (existing) throw new AppError('CONFLICT', 409, 'This slug is already in use');

  const row = await prisma.portfolioItem.create({
    data: {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      description: input.description ?? null,
      client: input.client ?? null,
      category: input.category ?? null,
      coverImage: input.coverImage ?? null,
      technologies: input.technologies ?? [],
      galleryImages: input.galleryImages ?? [],
      features: input.features ?? [],
      completionDate: input.completionDate ? new Date(input.completionDate) : null,
      projectStatus: input.projectStatus ?? null,
      liveDemoUrl: input.liveDemoUrl ?? null,
      caseStudyUrl: input.caseStudyUrl ?? null,
      featured: input.featured ?? false,
      isArchived: input.isArchived ?? false,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
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
  if (!item) throw new AppError('NOT_FOUND', 404, 'Portfolio item not found');

  if (input.slug && input.slug !== item.slug) {
    const clash = await prisma.portfolioItem.findUnique({ where: { slug: input.slug } });
    if (clash) throw new AppError('CONFLICT', 409, 'This slug is already in use');
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
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
      ...(input.technologies !== undefined ? { technologies: input.technologies } : {}),
      ...(input.galleryImages !== undefined ? { galleryImages: input.galleryImages } : {}),
      ...(input.features !== undefined ? { features: input.features } : {}),
      ...(input.completionDate !== undefined
        ? { completionDate: input.completionDate ? new Date(input.completionDate) : null }
        : {}),
      ...(input.projectStatus !== undefined ? { projectStatus: input.projectStatus } : {}),
      ...(input.liveDemoUrl !== undefined ? { liveDemoUrl: input.liveDemoUrl } : {}),
      ...(input.caseStudyUrl !== undefined ? { caseStudyUrl: input.caseStudyUrl } : {}),
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
      ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
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
  if (!item) throw new AppError('NOT_FOUND', 404, 'Portfolio item not found');
  await prisma.portfolioItem.delete({ where: { id } });
  await invalidateCache();
}

/** Aggregate only; neither endpoint nor table stores a visitor identifier. */
export async function recordPortfolioDemoClick(id: string): Promise<{ recorded: true }> {
  const updated = await prisma.portfolioItem.updateMany({
    where: { id, isPublished: true, isArchived: false, liveDemoUrl: { not: null } },
    data: { demoClicks: { increment: 1 } },
  });
  if (updated.count !== 1) throw new AppError('NOT_FOUND', 404, 'Live demo unavailable');
  return { recorded: true };
}

async function invalidateCache(): Promise<void> {
  try {
    await redis.del(LIST_CACHE_KEY);
  } catch {
    // Best-effort; the TTL will refresh it anyway.
  }
}
