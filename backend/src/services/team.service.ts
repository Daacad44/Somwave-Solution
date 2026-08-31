// Team members (W5.2, §5: only services touch Prisma). Public reads are cached
// best-effort in Redis; CMS writes (content.*) invalidate the cache.
import type {
  PublicTeamMember,
  AdminTeamMember,
  CreateTeamMemberInput,
  UpdateTeamMemberInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';

const CACHE_KEY = 'public:team';
const CACHE_TTL_SECONDS = 300;

export async function listPublishedTeam(): Promise<PublicTeamMember[]> {
  const cached = await safeGet(CACHE_KEY);
  if (cached) return JSON.parse(cached) as PublicTeamMember[];

  const rows = await prisma.teamMember.findMany({
    where: { isPublished: true },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, role: true, bio: true, photoUrl: true, linkedinUrl: true },
  });

  await safeSet(CACHE_KEY, JSON.stringify(rows));
  return rows;
}

// ── CMS (W5.2) — the admin view sees unpublished members too ──────────────────

const adminSelect = {
  id: true,
  name: true,
  role: true,
  bio: true,
  photoUrl: true,
  linkedinUrl: true,
  order: true,
  isPublished: true,
  createdAt: true,
} as const;

type TeamRow = {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  order: number;
  isPublished: boolean;
  createdAt: Date;
};

function toAdmin(row: TeamRow): AdminTeamMember {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listAllTeam(): Promise<AdminTeamMember[]> {
  const rows = await prisma.teamMember.findMany({
    orderBy: { order: 'asc' },
    select: adminSelect,
  });
  return rows.map(toAdmin);
}

export async function createTeamMember(input: CreateTeamMemberInput): Promise<AdminTeamMember> {
  const row = await prisma.teamMember.create({
    data: {
      name: input.name,
      role: input.role,
      bio: input.bio ?? null,
      photoUrl: input.photoUrl ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      order: input.order,
      isPublished: input.isPublished,
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

export async function updateTeamMember(
  id: string,
  input: UpdateTeamMemberInput,
): Promise<AdminTeamMember> {
  const member = await prisma.teamMember.findUnique({ where: { id } });
  if (!member) throw new AppError('NOT_FOUND', 404, 'Xubintan lama helin');

  const row = await prisma.teamMember.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
      ...(input.linkedinUrl !== undefined ? { linkedinUrl: input.linkedinUrl } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    },
    select: adminSelect,
  });
  await invalidateCache();
  return toAdmin(row);
}

export async function deleteTeamMember(id: string): Promise<void> {
  const member = await prisma.teamMember.findUnique({ where: { id } });
  if (!member) throw new AppError('NOT_FOUND', 404, 'Xubintan lama helin');
  await prisma.teamMember.delete({ where: { id } });
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
