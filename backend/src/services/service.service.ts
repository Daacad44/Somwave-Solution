// Website services (SYSTEM_PROMPT §5: only services touch Prisma). Public reads
// are cached in Redis (§5), with the cache treated as best-effort — a Redis
// outage falls through to the database rather than failing the request.
import type { PublicService } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

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
