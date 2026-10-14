import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type {
  ActivateEngineerInvitationInput,
  CreateEngineerAccountInput,
  UpdateEngineerAccountInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { hashPassword, verifyPassword } from '../lib/password';
import { generateRefreshToken, hashRefreshToken } from '../lib/tokens';
import { emailReadiness, sendMail } from '../lib/mailer';
import { ENGINEER_ACCOUNT_INVITE_V1 } from '../mail/templates';
import { emitNotification } from './notification-delivery.service';

const ENGINEER_ROLES = ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER'];
const INVITATION_HOURS = 48;
const ACTIVATION_MINUTES = 30;

type Actor = Pick<Express.AuthUserContext, 'id' | 'roles'>;

function requireAccountAdmin(actor: Actor): void {
  if (!actor.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN')) {
    throw new AppError('FORBIDDEN', 403, 'Administrator access required');
  }
}

function requireMailConfiguration(): void {
  const readiness = emailReadiness(true);
  if (!readiness.configured) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      503,
      `Engineer invitation email is not configured: ${readiness.missing.join(', ')}`,
    );
  }
}

export function engineerEmailReadiness(actor: Actor) {
  requireAccountAdmin(actor);
  return emailReadiness(true);
}

function invitationUrl(token: string): string {
  const url = new URL('/activate-engineer', env.APP_PUBLIC_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

function profileData(input: Partial<CreateEngineerAccountInput | UpdateEngineerAccountInput>) {
  return {
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
    ...(input.specialization !== undefined ? { specialization: input.specialization } : {}),
    ...(input.skills !== undefined ? { skills: [...new Set(input.skills)] } : {}),
    ...(input.experienceLevel !== undefined ? { experienceLevel: input.experienceLevel } : {}),
    ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
    ...(input.weeklyCapacityHours !== undefined
      ? { weeklyCapacityHours: new Prisma.Decimal(input.weeklyCapacityHours) }
      : {}),
    ...(input.availability !== undefined ? { availability: input.availability } : {}),
  };
}

const accountSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  engineerProfile: true,
  engineerAccountInvitation: {
    select: {
      id: true,
      status: true,
      deliveryStatus: true,
      expiresAt: true,
      lastSentAt: true,
      verifiedAt: true,
      activatedAt: true,
      providerMessageId: true,
    },
  },
} as const;

function serializeAccount<T extends { engineerProfile: { status: string } | null }>(account: T) {
  const { engineerProfile, ...rest } = account;
  return { ...rest, profile: engineerProfile };
}

async function getAccountOrThrow(userId: string) {
  const account = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, engineerProfile: { isNot: null } },
    select: accountSelect,
  });
  if (!account) throw new AppError('NOT_FOUND', 404, 'Engineer account not found');
  return serializeAccount(account);
}

async function deliverInvitation(userId: string, name: string, email: string, token: string) {
  const result = await sendMail({
    to: email,
    template: ENGINEER_ACCOUNT_INVITE_V1,
    vars: { name, setupUrl: invitationUrl(token), supportEmail: env.EMAIL_SUPPORT ?? '' },
    idempotencyKey: `engineer-invite:${userId}:${hashRefreshToken(token)}`,
  });
  await prisma.$transaction([
    prisma.engineerAccountInvitation.update({
      where: { userId },
      data: {
        deliveryStatus: result.sent ? 'ACCEPTED' : 'FAILED',
        providerMessageId: result.providerMessageId ?? null,
      },
    }),
    prisma.engineerProfile.update({
      where: { userId },
      data: { status: result.sent ? 'PENDING_VERIFICATION' : 'INVITED' },
    }),
  ]);
  if (!result.sent) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      503,
      result.reason === 'invalid_credentials'
        ? 'Resend rejected the email credentials; check the API key and sender domain'
        : 'Resend could not accept the engineer invitation email',
    );
  }
}

/** Create an engineer identity without granting Engineer access before email verification. */
async function provisionAccount(input: {
  email: string;
  name: string;
  actorId: string;
  profile?: Partial<CreateEngineerAccountInput>;
}) {
  requireMailConfiguration();
  const email = input.email.trim().toLowerCase();
  const token = generateRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_HOURS * 60 * 60_000);
  const result = await prisma.$transaction(async (tx) => {
    // Serialize invitation creation for the same email, including case variants.
    // Prisma cannot deserialize PostgreSQL's void return type, so cast it.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))::text AS locked`;
    const existing = await tx.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: {
        roles: { include: { role: true } },
        engineerProfile: true,
        engineerAccountInvitation: true,
      },
    });
    if (
      existing?.deletedAt ||
      (existing && !existing.isActive && !existing.engineerAccountInvitation)
    ) {
      throw new AppError('CONFLICT', 409, 'This email belongs to an unavailable account');
    }
    if (existing?.engineerAccountInvitation) {
      throw new AppError('CONFLICT', 409, 'An engineer invitation already exists for this email');
    }
    if (existing?.roles.some((item) => ENGINEER_ROLES.includes(item.role.name))) {
      throw new AppError('CONFLICT', 409, 'This engineer account already exists');
    }
    if (existing?.engineerProfile && existing.engineerProfile.status !== 'ACTIVE') {
      throw new AppError('CONFLICT', 409, 'Engineer account is not available for a new invitation');
    }
    const user =
      existing ??
      (await tx.user.create({
        data: {
          email,
          name: input.name,
          isActive: false,
          passwordHash: await hashPassword(randomBytes(32).toString('hex')),
        },
        include: {
          roles: { include: { role: true } },
          engineerProfile: true,
          engineerAccountInvitation: true,
        },
      }));
    await tx.engineerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, status: 'INVITED', ...profileData(input.profile ?? {}) },
      update: { status: 'INVITED', ...profileData(input.profile ?? {}) },
    });
    await tx.engineerAccountInvitation.create({
      data: {
        userId: user.id,
        invitedById: input.actorId,
        wasExistingUser: Boolean(existing),
        tokenHash: hashRefreshToken(token),
        expiresAt,
        lastSentAt: now,
        sendCount: 1,
        deliveryStatus: 'PENDING',
        providerMessageId: null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: 'engineer.account.invite',
        subjectType: 'EngineerProfile',
        subjectId: user.id,
      },
    });
    return { id: user.id, name: user.name, email: user.email };
  });
  await deliverInvitation(result.id, result.name, result.email, token);
  return result;
}

export async function createEngineerAccount(actor: Actor, input: CreateEngineerAccountInput) {
  requireAccountAdmin(actor);
  const user = await provisionAccount({
    email: input.email,
    name: input.name,
    actorId: actor.id,
    profile: input,
  });
  return getAccountOrThrow(user.id);
}

export async function ensureEngineerAccountForProjectInvite(input: {
  email: string;
  name?: string;
  actorId: string;
}): Promise<{ id: string; name: string; email: string }> {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: input.email.trim(), mode: 'insensitive' }, deletedAt: null },
    include: { roles: { include: { role: true } }, engineerAccountInvitation: true },
  });
  if (
    existing?.isActive &&
    existing.roles.some((item) => ENGINEER_ROLES.includes(item.role.name))
  ) {
    return { id: existing.id, name: existing.name, email: existing.email };
  }
  if (
    existing?.engineerAccountInvitation &&
    ['INVITED', 'VERIFIED'].includes(existing.engineerAccountInvitation.status)
  ) {
    return { id: existing.id, name: existing.name, email: existing.email };
  }
  if (!input.name && !existing?.name) {
    throw new AppError('VALIDATION_ERROR', 400, 'Name is required for a new engineer account');
  }
  return provisionAccount({
    email: input.email,
    name: input.name ?? existing!.name,
    actorId: input.actorId,
  });
}

export async function listEngineerAccounts(actor: Actor) {
  requireAccountAdmin(actor);
  const accounts = await prisma.user.findMany({
    where: { deletedAt: null, engineerProfile: { isNot: null } },
    select: accountSelect,
    orderBy: { name: 'asc' },
  });
  const ids = accounts.map((account) => account.id);
  if (!ids.length) return [];
  const [memberships, taskGroups, activityGroups] = await Promise.all([
    prisma.projectMember.findMany({
      where: {
        userId: { in: ids },
        removedAt: null,
        project: { deletedAt: null, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      },
      select: { userId: true, projectId: true },
    }),
    prisma.task.groupBy({
      by: ['assigneeId', 'status'],
      where: {
        assigneeId: { in: ids },
        deletedAt: null,
        approvalStatus: 'APPROVED',
        status: { notIn: ['DONE', 'CANCELLED'] },
        project: { deletedAt: null, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      },
      _count: { _all: true },
      _sum: { estimatedHours: true },
    }),
    prisma.auditLog.groupBy({
      by: ['actorId'],
      where: { actorId: { in: ids } },
      _max: { createdAt: true },
    }),
  ]);
  const projectsByUser = new Map<string, string[]>();
  for (const member of memberships) {
    const current = projectsByUser.get(member.userId) ?? [];
    current.push(member.projectId);
    projectsByUser.set(member.userId, current);
  }
  const tasksByUser = new Map<string, { count: number; hours: number; statuses: string[] }>();
  for (const group of taskGroups) {
    if (!group.assigneeId) continue;
    const current = tasksByUser.get(group.assigneeId) ?? { count: 0, hours: 0, statuses: [] };
    current.count += group._count._all;
    current.hours += Number(group._sum.estimatedHours ?? 0);
    current.statuses.push(group.status);
    tasksByUser.set(group.assigneeId, current);
  }
  const activityByUser = new Map(
    activityGroups.flatMap((group) =>
      group.actorId ? [[group.actorId, group._max.createdAt?.toISOString() ?? null] as const] : [],
    ),
  );
  return accounts.map((account) => {
    const task = tasksByUser.get(account.id);
    const projectIds = projectsByUser.get(account.id) ?? [];
    return {
      ...serializeAccount(account),
      activeProjects: projectIds.length,
      projectIds,
      assignedTasks: task?.count ?? 0,
      workloadHours: Math.round((task?.hours ?? 0) * 10) / 10,
      taskStatuses: task?.statuses ?? [],
      lastActivity: activityByUser.get(account.id) ?? null,
    };
  });
}

export async function getEngineerAccount(actor: Actor, userId: string) {
  requireAccountAdmin(actor);
  return getAccountOrThrow(userId);
}

export async function updateEngineerAccount(
  actor: Actor,
  userId: string,
  input: UpdateEngineerAccountInput,
) {
  requireAccountAdmin(actor);
  await getAccountOrThrow(userId);
  await prisma.$transaction(async (tx) => {
    if (input.name !== undefined) {
      await tx.user.update({ where: { id: userId }, data: { name: input.name } });
    }
    await tx.engineerProfile.update({ where: { userId }, data: profileData(input) });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'engineer.account.profile.update',
        subjectType: 'EngineerProfile',
        subjectId: userId,
      },
    });
  });
  return getAccountOrThrow(userId);
}

async function sendFreshInvitation(
  account: { id: string; name: string; email: string },
  actorId: string | null,
) {
  requireMailConfiguration();
  const invitation = await prisma.engineerAccountInvitation.findUnique({
    where: { userId: account.id },
  });
  if (!invitation || !['INVITED', 'VERIFIED'].includes(invitation.status)) {
    throw new AppError('CONFLICT', 409, 'There is no pending engineer invitation');
  }
  const now = new Date();
  if (invitation.lastSentAt && now.getTime() - invitation.lastSentAt.getTime() < 60_000) {
    throw new AppError('RATE_LIMITED', 429, 'Wait one minute before resending');
  }
  if (
    invitation.sendCount >= 5 &&
    invitation.lastSentAt &&
    now.getTime() - invitation.lastSentAt.getTime() < 24 * 60 * 60_000
  ) {
    throw new AppError('RATE_LIMITED', 429, 'Daily invitation limit reached');
  }
  const token = generateRefreshToken();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.engineerAccountInvitation.updateMany({
      where: {
        id: invitation.id,
        status: { in: ['INVITED', 'VERIFIED'] },
        OR: [{ lastSentAt: null }, { lastSentAt: { lte: new Date(now.getTime() - 60_000) } }],
      },
      data: {
        tokenHash: hashRefreshToken(token),
        status: 'INVITED',
        activationTokenHash: null,
        expiresAt: new Date(now.getTime() + INVITATION_HOURS * 60 * 60_000),
        activationExpiresAt: null,
        lastSentAt: now,
        sendCount:
          invitation.lastSentAt &&
          now.getTime() - invitation.lastSentAt.getTime() < 24 * 60 * 60_000
            ? { increment: 1 }
            : 1,
        deliveryStatus: 'PENDING',
        providerMessageId: null,
      },
    });
    if (!claimed.count) throw new AppError('RATE_LIMITED', 429, 'Invitation was recently resent');
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'engineer.account.invitation.resend',
        subjectType: 'EngineerProfile',
        subjectId: account.id,
      },
    });
  });
  await deliverInvitation(account.id, account.name, account.email, token);
}

export async function resendEngineerInvitation(actor: Actor, userId: string) {
  requireAccountAdmin(actor);
  const account = await getAccountOrThrow(userId);
  await sendFreshInvitation(account, actor.id);
  return getAccountOrThrow(userId);
}

/** Public response is intentionally identical for unknown, expired and throttled accounts. */
export async function requestEngineerVerificationResend(email: string) {
  const account = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      deletedAt: null,
      engineerAccountInvitation: { is: { status: { in: ['INVITED', 'VERIFIED'] } } },
    },
    select: { id: true, name: true, email: true },
  });
  if (account) {
    try {
      await sendFreshInvitation(account, null);
    } catch (error) {
      logger.warn({ userId: account.id, err: error }, 'Engineer verification resend unavailable');
    }
  }
  return { ok: true };
}

export async function cancelEngineerInvitation(actor: Actor, userId: string) {
  requireAccountAdmin(actor);
  const invitation = await prisma.engineerAccountInvitation.findUnique({ where: { userId } });
  if (!invitation || invitation.status === 'ACTIVATED' || invitation.status === 'CANCELLED') {
    throw new AppError('CONFLICT', 409, 'There is no pending engineer invitation');
  }
  await prisma.$transaction(async (tx) => {
    await tx.engineerAccountInvitation.update({
      where: { userId },
      data: { status: 'CANCELLED', activationTokenHash: null },
    });
    await tx.engineerProfile.update({ where: { userId }, data: { status: 'DEACTIVATED' } });
    if (!invitation.wasExistingUser)
      await tx.user.update({ where: { id: userId }, data: { isActive: false } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'engineer.account.invitation.cancel',
        subjectType: 'EngineerProfile',
        subjectId: userId,
      },
    });
  });
  return getAccountOrThrow(userId);
}

export async function verifyEngineerInvitation(token: string) {
  const tokenHash = hashRefreshToken(token);
  const invitation = await prisma.engineerAccountInvitation.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, name: true, email: true, engineerProfile: true } } },
  });
  if (!invitation || invitation.status !== 'INVITED') {
    throw new AppError('NOT_FOUND', 404, 'Invalid invitation link');
  }
  if (invitation.expiresAt.getTime() <= Date.now()) {
    throw new AppError('VALIDATION_ERROR', 410, 'Invitation link has expired');
  }
  const activationToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + ACTIVATION_MINUTES * 60_000);
  const claimed = await prisma.engineerAccountInvitation.updateMany({
    where: { id: invitation.id, status: 'INVITED', tokenHash, expiresAt: { gt: new Date() } },
    data: {
      status: 'VERIFIED',
      tokenHash: hashRefreshToken(generateRefreshToken()),
      activationTokenHash: hashRefreshToken(activationToken),
      activationExpiresAt: expiresAt,
      verifiedAt: new Date(),
    },
  });
  if (!claimed.count) throw new AppError('NOT_FOUND', 404, 'Invitation link has already been used');
  await prisma.$transaction([
    prisma.engineerProfile.update({
      where: { userId: invitation.userId },
      data: { status: 'PENDING_ACTIVATION' },
    }),
    prisma.auditLog.create({
      data: {
        actorId: null,
        action: 'engineer.account.email.verify',
        subjectType: 'EngineerProfile',
        subjectId: invitation.userId,
      },
    }),
  ]);
  return {
    activationToken,
    name: invitation.user.name,
    email: invitation.user.email,
    expiresAt,
    existingAccount: invitation.wasExistingUser,
    profile: invitation.user.engineerProfile,
  };
}

export async function activateEngineerInvitation(input: ActivateEngineerInvitationInput) {
  const tokenHash = hashRefreshToken(input.activationToken);
  const invitation = await prisma.engineerAccountInvitation.findUnique({
    where: { activationTokenHash: tokenHash },
    include: { user: { include: { engineerProfile: true } } },
  });
  if (!invitation || invitation.status !== 'VERIFIED') {
    throw new AppError('NOT_FOUND', 404, 'Invalid activation link');
  }
  if (!invitation.activationExpiresAt || invitation.activationExpiresAt.getTime() <= Date.now()) {
    throw new AppError(
      'VALIDATION_ERROR',
      410,
      'Activation link has expired; ask an administrator to resend the invitation',
    );
  }
  const profile = invitation.user.engineerProfile;
  if (!profile) throw new AppError('CONFLICT', 409, 'Engineer profile is missing');
  for (const key of ['jobTitle', 'specialization', 'experienceLevel', 'employmentType'] as const) {
    if (!input[key] && !profile[key]) {
      throw new AppError('VALIDATION_ERROR', 400, `${key} is required to activate the account`);
    }
  }
  if (
    invitation.wasExistingUser &&
    !(await verifyPassword(input.password, invitation.user.passwordHash))
  ) {
    throw new AppError('UNAUTHORIZED', 401, 'Incorrect account password');
  }
  const engineerRole = await prisma.role.findUnique({
    where: { name: 'ENGINEER' },
    select: { id: true },
  });
  if (!engineerRole)
    throw new AppError('SERVICE_UNAVAILABLE', 503, 'Engineer role is not configured');
  const claimed = await prisma.$transaction(async (tx) => {
    const update = await tx.engineerAccountInvitation.updateMany({
      where: {
        id: invitation.id,
        status: 'VERIFIED',
        activationTokenHash: tokenHash,
        activationExpiresAt: { gt: new Date() },
      },
      data: { status: 'ACTIVATED', activationTokenHash: null, activatedAt: new Date() },
    });
    if (!update.count) return false;
    await tx.user.update({
      where: { id: invitation.userId },
      data: {
        isActive: true,
        ...(!invitation.wasExistingUser
          ? { passwordHash: await hashPassword(input.password) }
          : {}),
        roles: {
          upsert: {
            where: { userId_roleId: { userId: invitation.userId, roleId: engineerRole.id } },
            create: { roleId: engineerRole.id },
            update: {},
          },
        },
      },
    });
    await tx.engineerProfile.update({
      where: { userId: invitation.userId },
      data: { status: 'ACTIVE', ...profileData(input) },
    });
    await tx.auditLog.create({
      data: {
        actorId: invitation.userId,
        action: 'engineer.account.activate',
        subjectType: 'EngineerProfile',
        subjectId: invitation.userId,
      },
    });
    return true;
  });
  if (!claimed) throw new AppError('CONFLICT', 409, 'Invitation has already been activated');
  try {
    await emitNotification({
      eventKey: 'engineer.account.activated',
      userId: invitation.invitedById,
      title: 'Engineer account activated',
      body: `${invitation.user.name} activated their Somwave engineer account.`,
      dedupeKey: `engineer-activated:${invitation.id}`,
    });
    const pending = await prisma.projectInvitation.findMany({
      where: { userId: invitation.userId, status: 'PENDING' },
      include: { project: { select: { name: true } } },
    });
    for (const item of pending) {
      await emitNotification({
        eventKey: 'project.assignment',
        userId: invitation.userId,
        title: `Project invitation: ${item.project.name}`,
        body: `Review and respond to your invitation to ${item.project.name} in Engineering.`,
        dedupeKey: `project-invitation-activated:${item.id}`,
        requiredEmail: true,
      });
    }
  } catch (error) {
    logger.error(
      { err: error, userId: invitation.userId },
      'Engineer activation notification failed',
    );
  }
  return { ok: true };
}

export async function setEngineerAccountSuspended(
  actor: Actor,
  userId: string,
  suspended: boolean,
) {
  requireAccountAdmin(actor);
  const account = await getAccountOrThrow(userId);
  if (suspended && account.profile?.status !== 'ACTIVE') {
    throw new AppError('CONFLICT', 409, 'Only active engineer accounts can be suspended');
  }
  if (!suspended && !['SUSPENDED', 'DEACTIVATED'].includes(account.profile?.status ?? '')) {
    throw new AppError('CONFLICT', 409, 'Engineer account is not suspended or deactivated');
  }
  if (
    !suspended &&
    account.engineerAccountInvitation &&
    account.engineerAccountInvitation.status !== 'ACTIVATED'
  ) {
    throw new AppError('CONFLICT', 409, 'Invitation must be activated before reactivation');
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { isActive: !suspended } }),
    prisma.engineerProfile.update({
      where: { userId },
      data: { status: suspended ? 'SUSPENDED' : 'ACTIVE' },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: suspended ? 'engineer.account.suspend' : 'engineer.account.reactivate',
        subjectType: 'EngineerProfile',
        subjectId: userId,
      },
    }),
  ]);
  return getAccountOrThrow(userId);
}

export async function listEngineerAccountActivity(actor: Actor, userId: string) {
  requireAccountAdmin(actor);
  await getAccountOrThrow(userId);
  const [accountEvents, assignmentEvents] = await Promise.all([
    prisma.auditLog.findMany({
      where: { subjectType: 'EngineerProfile', subjectId: userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.projectAssignmentEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    }),
  ]);
  return [
    ...accountEvents,
    ...assignmentEvents.map((event) => ({
      id: event.id,
      action: `project.assignment.${event.action.toLowerCase()}`,
      actorId: event.actorId,
      subjectType: 'ProjectAssignment',
      subjectId: event.projectId,
      createdAt: event.occurredAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 200);
}
