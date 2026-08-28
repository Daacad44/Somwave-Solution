// Website services (SYSTEM_PROMPT §5: only services touch Prisma). Public reads
// are cached in Redis (§5), with the cache treated as best-effort — a Redis
// outage falls through to the database rather than failing the request. CMS
// writes (W4) invalidate the cache so the public site reflects them.
import type {
  PublicService,
  AdminService,
  CreateServiceInput,
  UpdateServiceInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';

const CACHE_KEY = 'public:services';
const CACHE_TTL_SECONDS = 300;

export async function listPublishedServices(): Promise<PublicService[]> {
  const cached = await readCache();
  if (cached) return cached;

  const services = await prisma.service.findMany({
    where: { isPublished: true },
    orderBy: { order: 'asc' },
    select: { id: true, slug: true, title: true, summary: true, order: true },
  });

  await writeCache(services);
  return services;
}

// ── CMS (W4) — the admin view sees unpublished services too ───────────────────

const adminServiceSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  description: true,
  icon: true,
  order: true,
  isPublished: true,
  createdAt: true,
} as const;

type ServiceRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  icon: string | null;
  order: number;
  isPublished: boolean;
  createdAt: Date;
};

function toAdminService(row: ServiceRow): AdminService {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listAllServices(): Promise<AdminService[]> {
  const rows = await prisma.service.findMany({
    orderBy: { order: 'asc' },
    select: adminServiceSelect,
  });
  return rows.map(toAdminService);
}

export async function createService(input: CreateServiceInput): Promise<AdminService> {
  const existing = await prisma.service.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError('CONFLICT', 409, 'Slug-kan horey ayaa loo isticmaalay');

  const row = await prisma.service.create({
    data: {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      description: input.description ?? null,
      order: input.order,
      isPublished: input.isPublished,
    },
    select: adminServiceSelect,
  });
  await invalidateCache();
  return toAdminService(row);
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<AdminService> {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new AppError('NOT_FOUND', 404, 'Adeegan lama helin');

  // A new slug must stay unique.
  if (input.slug && input.slug !== service.slug) {
    const clash = await prisma.service.findUnique({ where: { slug: input.slug } });
    if (clash) throw new AppError('CONFLICT', 409, 'Slug-kan horey ayaa loo isticmaalay');
  }

  const row = await prisma.service.update({
    where: { id },
    data: {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    },
    select: adminServiceSelect,
  });
  await invalidateCache();
  return toAdminService(row);
}

export async function deleteService(id: string): Promise<void> {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new AppError('NOT_FOUND', 404, 'Adeegan lama helin');
  await prisma.service.delete({ where: { id } });
  await invalidateCache();
}

async function invalidateCache(): Promise<void> {
  try {
    await redis.del(CACHE_KEY);
  } catch {
    // Best-effort; the cache TTL will refresh it anyway.
  }
}

async function readCache(): Promise<PublicService[] | null> {
  try {
    const raw = await redis.get(CACHE_KEY);
    return raw ? (JSON.parse(raw) as PublicService[]) : null;
  } catch {
    return null;
  }
}

async function writeCache(services: PublicService[]): Promise<void> {
  try {
    await redis.set(CACHE_KEY, JSON.stringify(services), 'EX', CACHE_TTL_SECONDS);
  } catch {
    // Best-effort cache; ignore write failures.
  }
}
