import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    teamMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import {
  listPublishedTeam,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from './team.service';

const publicRow = {
  id: 'm1',
  name: 'Hodan',
  role: 'Designer',
  bio: null,
  photoUrl: null,
  linkedinUrl: null,
};

const adminRow = {
  ...publicRow,
  order: 1,
  isPublished: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.get).mockResolvedValue(null);
});

describe('listPublishedTeam', () => {
  it('serves the cached list without hitting the database', async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify([publicRow]));
    const result = await listPublishedTeam();
    expect(result).toEqual([publicRow]);
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
  });

  it('reads published members ordered, then caches them', async () => {
    vi.mocked(prisma.teamMember.findMany).mockResolvedValue([publicRow] as never);
    const result = await listPublishedTeam();
    expect(result).toEqual([publicRow]);
    expect(prisma.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true }, orderBy: { order: 'asc' } }),
    );
    expect(redis.set).toHaveBeenCalled();
  });
});

describe('createTeamMember', () => {
  it('creates a member and invalidates the public cache', async () => {
    vi.mocked(prisma.teamMember.create).mockResolvedValue(adminRow as never);

    const result = await createTeamMember({
      name: 'Hodan',
      role: 'Designer',
      order: 1,
      isPublished: true,
    });

    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(redis.del).toHaveBeenCalledWith('public:team');
  });
});

describe('updateTeamMember', () => {
  it('throws NOT_FOUND when the member is missing', async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);
    await expect(updateTeamMember('missing', { name: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('deleteTeamMember', () => {
  it('deletes an existing member and invalidates the cache', async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({ id: 'm1' } as never);
    vi.mocked(prisma.teamMember.delete).mockResolvedValue({} as never);

    await deleteTeamMember('m1');

    expect(prisma.teamMember.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(redis.del).toHaveBeenCalledWith('public:team');
  });
});
