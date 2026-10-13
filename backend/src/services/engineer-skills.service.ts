import { Prisma } from '@prisma/client';
import type {
  EngineerSkillSearch,
  ReplaceEngineerSkillsInput,
  ReplaceEngineerWeeklyScheduleInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

type Actor = Express.AuthUserContext;

function requireSelfEngineer(actor: Actor) {
  if (!actor.roles.some((role) => ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER'].includes(role)))
    throw new AppError('FORBIDDEN', 403, 'Engineer role required');
}

function requireAdmin(actor: Actor) {
  if (!actor.roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)))
    throw new AppError('FORBIDDEN', 403, 'Administrator access required');
}

async function getProfile(userId: string) {
  const profile = await prisma.engineerProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      status: true,
      specialization: true,
      secondarySpecializations: true,
      timezone: true,
      weeklyCapacityHours: true,
    },
  });
  return profile;
}

function requireActive(profile: Awaited<ReturnType<typeof getProfile>>) {
  if (profile && profile.status !== 'ACTIVE')
    throw new AppError('FORBIDDEN', 403, 'Engineer account is inactive');
}

export async function getEngineerSkills(userId: string, actor: Actor, own = false) {
  if (own) requireSelfEngineer(actor);
  else requireAdmin(actor);
  const profile = await getProfile(userId);
  if (own) requireActive(profile);
  if (!profile && !own) throw new AppError('NOT_FOUND', 404, 'Engineer not found');
  const skills = profile
    ? await prisma.engineerSkill.findMany({
        where: { userId },
        orderBy: [{ isPrimary: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      })
    : [];
  return {
    profile: profile ?? {
      userId,
      specialization: null,
      secondarySpecializations: [],
      timezone: 'UTC',
      weeklyCapacityHours: 40,
    },
    skills,
  };
}

export async function replaceEngineerSkills(actor: Actor, input: ReplaceEngineerSkillsInput) {
  requireSelfEngineer(actor);
  requireActive(await getProfile(actor.id));
  await prisma.$transaction(async (tx) => {
    await tx.engineerProfile.upsert({
      where: { userId: actor.id },
      create: {
        userId: actor.id,
        skills: input.skills.map((item) => item.name),
        secondarySpecializations: input.secondarySpecializations,
      },
      update: {
        skills: input.skills.map((item) => item.name),
        secondarySpecializations: input.secondarySpecializations,
      },
    });
    await tx.engineerSkill.deleteMany({ where: { userId: actor.id } });
    if (input.skills.length)
      await tx.engineerSkill.createMany({
        data: input.skills.map((item) => ({
          userId: actor.id,
          category: item.category,
          name: item.name,
          level: item.level,
          experienceYears: new Prisma.Decimal(item.experienceYears),
          isPrimary: item.isPrimary,
        })),
      });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'engineer.skills.replace',
        subjectType: 'EngineerProfile',
        subjectId: actor.id,
      },
    });
  });
  return getEngineerSkills(actor.id, actor, true);
}

export async function getEngineerWeeklySchedule(userId: string, actor: Actor, own = false) {
  if (own) requireSelfEngineer(actor);
  else requireAdmin(actor);
  const profile = await getProfile(userId);
  if (own) requireActive(profile);
  if (!profile && !own) throw new AppError('NOT_FOUND', 404, 'Engineer not found');
  const slots = profile
    ? await prisma.engineerWeeklySchedule.findMany({
        where: { userId },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      })
    : [];
  return { profile: profile ?? { userId, timezone: 'UTC', weeklyCapacityHours: 40 }, slots };
}

export async function replaceEngineerWeeklySchedule(
  actor: Actor,
  input: ReplaceEngineerWeeklyScheduleInput,
) {
  requireSelfEngineer(actor);
  requireActive(await getProfile(actor.id));
  const weeklyHours =
    input.slots.reduce((total, slot) => total + slot.endMinute - slot.startMinute, 0) / 60;
  await prisma.$transaction(async (tx) => {
    await tx.engineerProfile.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, weeklyCapacityHours: new Prisma.Decimal(weeklyHours) },
      update: { weeklyCapacityHours: new Prisma.Decimal(weeklyHours) },
    });
    await tx.engineerWeeklySchedule.deleteMany({ where: { userId: actor.id } });
    if (input.slots.length)
      await tx.engineerWeeklySchedule.createMany({
        data: input.slots.map((slot) => ({ userId: actor.id, ...slot })),
      });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'engineer.schedule.replace',
        subjectType: 'EngineerProfile',
        subjectId: actor.id,
      },
    });
  });
  return getEngineerWeeklySchedule(actor.id, actor, true);
}

export async function searchEngineersBySkill(actor: Actor, filter: EngineerSkillSearch) {
  requireAdmin(actor);
  const profiles = await prisma.engineerProfile.findMany({
    where: {
      status: 'ACTIVE',
      user: { isActive: true, deletedAt: null },
      structuredSkills: {
        some: {
          ...(filter.category ? { category: filter.category } : {}),
          ...(filter.level ? { level: filter.level } : {}),
          ...(filter.name ? { name: { contains: filter.name, mode: 'insensitive' } } : {}),
        },
      },
    },
    select: {
      userId: true,
      specialization: true,
      secondarySpecializations: true,
      availability: true,
      user: { select: { name: true, email: true } },
      structuredSkills: {
        where: {
          ...(filter.category ? { category: filter.category } : {}),
          ...(filter.level ? { level: filter.level } : {}),
          ...(filter.name ? { name: { contains: filter.name, mode: 'insensitive' } } : {}),
        },
        orderBy: { name: 'asc' },
      },
    },
    take: 100,
    orderBy: { userId: 'asc' },
  });
  return profiles;
}
