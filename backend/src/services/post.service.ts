// Blog (SYSTEM_PROMPT §5, §10). Published posts, paginated and Redis-cached
// (best-effort). Dates are mapped to ISO strings at this layer so the DTO the
// client receives matches the shared schema exactly.
import type {
  PublicPostSummary,
  PublicPostDetail,
  AdminPost,
  AdminCategory,
  CreatePostInput,
  UpdatePostInput,
} from '@somwave/shared';
import { MAX_PAGE_SIZE } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';

const CACHE_TTL_SECONDS = 300;
const CACHE_PREFIX = 'public:posts:';

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
  const cacheKey = `${CACHE_PREFIX}p${current}:s${size}`;

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

// ── CMS (W4) — the admin view sees unpublished posts too ──────────────────────

const adminPostSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  coverImage: true,
  isPublished: true,
  publishedAt: true,
  categoryId: true,
  createdAt: true,
  category: { select: { slug: true, name: true } },
} as const;

type AdminPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  categoryId: string | null;
  createdAt: Date;
  category: { slug: string; name: string } | null;
};

function toAdminPost(row: AdminPostRow): AdminPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    coverImage: row.coverImage,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    categoryId: row.categoryId,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAllPosts(): Promise<AdminPost[]> {
  const rows = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    select: adminPostSelect,
  });
  return rows.map(toAdminPost);
}

export function listCategories(): Promise<AdminCategory[]> {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, slug: true, name: true },
  });
}

async function assertCategoryExists(categoryId: string | null | undefined): Promise<void> {
  if (!categoryId) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError('VALIDATION_ERROR', 400, 'Qaybta lama helin');
}

export async function createPost(input: CreatePostInput): Promise<AdminPost> {
  const existing = await prisma.post.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError('CONFLICT', 409, 'Slug-kan horey ayaa loo isticmaalay');
  await assertCategoryExists(input.categoryId);

  const row = await prisma.post.create({
    data: {
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      body: input.body,
      coverImage: input.coverImage ?? null,
      categoryId: input.categoryId ?? null,
      isPublished: input.isPublished,
      publishedAt: input.isPublished ? new Date() : null,
    },
    select: adminPostSelect,
  });
  await invalidateCache();
  return toAdminPost(row);
}

export async function updatePost(id: string, input: UpdatePostInput): Promise<AdminPost> {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new AppError('NOT_FOUND', 404, 'Maqaalkan lama helin');

  if (input.slug && input.slug !== post.slug) {
    const clash = await prisma.post.findUnique({ where: { slug: input.slug } });
    if (clash) throw new AppError('CONFLICT', 409, 'Slug-kan horey ayaa loo isticmaalay');
  }
  if (input.categoryId) await assertCategoryExists(input.categoryId);

  // Stamp publishedAt the first time a post is published.
  const publishing = input.isPublished === true && !post.isPublished;

  const row = await prisma.post.update({
    where: { id },
    data: {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(publishing && !post.publishedAt ? { publishedAt: new Date() } : {}),
    },
    select: adminPostSelect,
  });
  await invalidateCache();
  return toAdminPost(row);
}

export async function deletePost(id: string): Promise<void> {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new AppError('NOT_FOUND', 404, 'Maqaalkan lama helin');
  await prisma.post.delete({ where: { id } });
  await invalidateCache();
}

// The public list is cached per page/size, so clear the whole keyspace on a write.
async function invalidateCache(): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${CACHE_PREFIX}*`, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch {
    // Best-effort; TTL will expire stale entries anyway.
  }
}
