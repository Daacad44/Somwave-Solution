// Blog (SYSTEM_PROMPT §5, §10). Published posts, paginated and Redis-cached
// (best-effort). Dates are mapped to ISO strings at this layer so the DTO the
// client receives matches the shared schema exactly.
import type { PublicPostSummary, PublicPostDetail } from '@somwave/shared';
import { MAX_PAGE_SIZE } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const CACHE_TTL_SECONDS = 300;

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  publishedAt: Date | null;
  category: { slug: string; name: string } | null;
}

function toSummary(row: PostRow): PublicPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImage: row.coverImage,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    category: row.category,
  };
}

export interface PostPage {
  items: PublicPostSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listPublishedPosts(page: number, pageSize: number): Promise<PostPage> {
  const size = Math.min(Math.max(Math.trunc(pageSize), 1), MAX_PAGE_SIZE);
  const current = Math.max(Math.trunc(page), 1);
  const cacheKey = `public:posts:p${current}:s${size}`;

  const cached = await safeGet(cacheKey);
  if (cached) return JSON.parse(cached) as PostPage;

  const where = { isPublished: true };
  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (current - 1) * size,
      take: size,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        publishedAt: true,
        category: { select: { slug: true, name: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  const result: PostPage = { items: rows.map(toSummary), total, page: current, pageSize: size };
  await safeSet(cacheKey, JSON.stringify(result));
  return result;
}

export async function getPostBySlug(slug: string): Promise<PublicPostDetail | null> {
  const post = await prisma.post.findFirst({
    where: { slug, isPublished: true },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      coverImage: true,
      publishedAt: true,
      category: { select: { slug: true, name: true } },
    },
  });
  if (!post) return null;
  return { ...toSummary(post), body: post.body };
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
