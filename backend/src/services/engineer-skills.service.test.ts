import { beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceEngineerSkillsSchema, replaceEngineerWeeklyScheduleSchema } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: {
    engineerProfile: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    engineerSkill: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    engineerWeeklySchedule: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma';
import {
  getEngineerSkills,
  replaceEngineerSkills,
  replaceEngineerWeeklySchedule,
  searchEngineersBySkill,
} from './engineer-skills.service';

const engineer = {
  id: 'engineer-a',
  email: 'a@example.test',
  name: 'A',
  roles: ['ENGINEER'],
  permissions: [],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};
const admin = { ...engineer, id: 'admin-a', roles: ['ADMIN'] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.engineerProfile.findUnique).mockResolvedValue({
    userId: 'engineer-a',
    status: 'ACTIVE',
    specialization: 'Backend Engineer',
    secondarySpecializations: [],
    timezone: 'Africa/Nairobi',
    weeklyCapacityHours: 40,
  } as never);
  vi.mocked(prisma.engineerSkill.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.engineerWeeklySchedule.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.$transaction).mockImplementation((async (callback: unknown) =>
    (callback as (tx: typeof prisma) => Promise<unknown>)(prisma)) as never);
});

describe('engineer skills and schedule', () => {
  it('rejects duplicate and multiple primary skills', () => {
    const item = {
      category: 'BACKEND',
      name: 'TypeScript',
      level: 'ADVANCED',
      experienceYears: 5,
      isPrimary: true,
    };
    expect(
      replaceEngineerSkillsSchema.safeParse({ skills: [item, { ...item, name: 'typescript' }] })
        .success,
    ).toBe(false);
    expect(
      replaceEngineerSkillsSchema.safeParse({ skills: [item, { ...item, name: 'PostgreSQL' }] })
        .success,
    ).toBe(false);
  });

  it('rejects overlapping schedule slots', () => {
    expect(
      replaceEngineerWeeklyScheduleSchema.safeParse({
        slots: [
          { weekday: 1, startMinute: 540, endMinute: 720 },
          { weekday: 1, startMinute: 660, endMinute: 780 },
        ],
      }).success,
    ).toBe(false);
  });

  it('lets an engineer replace skills while retaining a legacy summary', async () => {
    const input = replaceEngineerSkillsSchema.parse({
      skills: [
        {
          category: 'BACKEND',
          name: 'TypeScript',
          level: 'ADVANCED',
          experienceYears: 5,
          isPrimary: true,
        },
      ],
      secondarySpecializations: ['Database Engineer'],
    });
    await replaceEngineerSkills(engineer, input);
    expect(prisma.engineerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { skills: ['TypeScript'], secondarySpecializations: ['Database Engineer'] },
      }),
    );
    expect(prisma.engineerSkill.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ userId: engineer.id, name: 'TypeScript', isPrimary: true }),
        ],
      }),
    );
  });

  it('derives weekly capacity from valid working slots', async () => {
    const input = replaceEngineerWeeklyScheduleSchema.parse({
      slots: [
        { weekday: 1, startMinute: 540, endMinute: 1020 },
        { weekday: 2, startMinute: 540, endMinute: 1020 },
      ],
    });
    await replaceEngineerWeeklySchedule(engineer, input);
    expect(prisma.engineerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          weeklyCapacityHours: expect.objectContaining({ toNumber: expect.any(Function) }),
        },
      }),
    );
    expect(prisma.engineerWeeklySchedule.createMany).toHaveBeenCalledWith({
      data: [
        { userId: engineer.id, weekday: 1, startMinute: 540, endMinute: 1020 },
        { userId: engineer.id, weekday: 2, startMinute: 540, endMinute: 1020 },
      ],
    });
  });

  it('prevents a suspended engineer from editing skills', async () => {
    vi.mocked(prisma.engineerProfile.findUnique).mockResolvedValue({
      status: 'SUSPENDED',
    } as never);
    await expect(
      replaceEngineerSkills(engineer, { skills: [], secondarySpecializations: [] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.engineerSkill.deleteMany).not.toHaveBeenCalled();
  });

  it('permits administrator inspection of suspended profiles but blocks unrelated staff', async () => {
    vi.mocked(prisma.engineerProfile.findUnique).mockResolvedValue({
      status: 'SUSPENDED',
    } as never);
    await expect(getEngineerSkills(engineer.id, admin)).resolves.toHaveProperty('skills');
    await expect(
      getEngineerSkills(engineer.id, { ...engineer, roles: ['STAFF'] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('restricts skill-based search to administrators', async () => {
    await expect(searchEngineersBySkill(engineer, { category: 'BACKEND' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.engineerProfile.findMany).not.toHaveBeenCalled();
  });
});
