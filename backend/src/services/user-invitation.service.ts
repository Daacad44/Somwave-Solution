import { randomBytes } from 'node:crypto';
import type { AuthUser, CreateUserInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { hashRefreshToken } from '../lib/tokens';
import { hashPassword } from '../lib/password';
import { assertNewPasswordAllowed } from '../lib/password-policy';
import { sendMail, emailReadiness } from '../lib/mailer';
import { env } from '../lib/env';
import { USER_INVITATION_V1, ACCOUNT_ACTIVATED_V1 } from '../mail/templates';

export async function assertInvitationRoles(roleIds: string[], actor: AuthUser) {
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { id: true, name: true },
  });
  if (roles.length !== new Set(roleIds).size || !roles.length)
    throw new AppError('VALIDATION_ERROR', 400, 'Select valid authorized roles');
  if (roles.some((r) => r.name === 'SUPER_ADMIN') && !actor.roles.includes('SUPER_ADMIN'))
    throw new AppError('FORBIDDEN', 403, 'Only a super administrator can assign this role');
  if (roles.some((r) => r.name === 'CLIENT') && roles.length !== 1)
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Client access cannot be combined with internal roles',
    );
  return roles;
}
function safe(row: {
  id: string;
  email: string;
  name: string;
  roleIds: string[];
  status: string;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roleIds: row.roleIds,
    status:
      row.status === 'PENDING' && row.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
export async function listInvitations() {
  return (await prisma.userInvitation.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })).map(
    safe,
  );
}
export async function inviteUser(input: CreateUserInput, actor: AuthUser) {
  const email = input.email.trim().toLowerCase();
  await assertInvitationRoles(input.roleIds, actor);
  if (!emailReadiness(true).configured)
    throw new AppError('SERVICE_UNAVAILABLE', 503, 'Invitation email is not configured');
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }))
    throw new AppError('CONFLICT', 409, 'This email already has an account');
  const previous = await prisma.userInvitation.findUnique({ where: { email } });
  if (previous?.status === 'PENDING' && previous.expiresAt.getTime() > Date.now())
    throw new AppError('CONFLICT', 409, 'An invitation is already pending; use resend');
  const token = randomBytes(32).toString('hex');
  const data = {
    email,
    name: input.name,
    roleIds: [...new Set(input.roleIds)],
    tokenHash: hashRefreshToken(token),
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 48 * 3600000),
    invitedById: actor.id,
    acceptedAt: null,
  };
  const row = await prisma.userInvitation.upsert({ where: { email }, create: data, update: data });
  const sent = await sendMail({
    to: email,
    template: USER_INVITATION_V1,
    vars: {
      name: input.name,
      setupUrl: `${env.APP_PUBLIC_URL!.replace(/\/$/, '')}/activate-account?token=${token}`,
    },
    idempotencyKey: `user-invite:${row.id}:${row.tokenHash}`,
  });
  if (!sent.sent) {
    await prisma.userInvitation.updateMany({
      where: { id: row.id, tokenHash: row.tokenHash },
      data: { status: 'CANCELLED' },
    });
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      503,
      'Invitation email could not be sent; retry from invitation management',
    );
  }
  await writeAudit({
    actorId: actor.id,
    action: 'user.invitation.sent',
    subjectType: 'UserInvitation',
    subjectId: row.id,
  });
  return safe(row);
}
export async function manageInvitation(id: string, action: 'resend' | 'cancel', actor: AuthUser) {
  const row = await prisma.userInvitation.findUnique({ where: { id } });
  if (!row || row.status === 'ACCEPTED')
    throw new AppError('NOT_FOUND', 404, 'Pending invitation not found');
  await assertInvitationRoles(row.roleIds, actor);
  if (action === 'resend' && row.updatedAt.getTime() > Date.now() - 60000)
    throw new AppError('RATE_LIMITED', 429, 'Wait one minute before resending');
  const cancelled = await prisma.userInvitation.updateMany({
    where: { id, status: { not: 'ACCEPTED' }, tokenHash: row.tokenHash },
    data: { status: 'CANCELLED', tokenHash: hashRefreshToken(randomBytes(32).toString('hex')) },
  });
  if (cancelled.count !== 1)
    throw new AppError('CONFLICT', 409, 'Invitation changed; refresh and try again');
  await writeAudit({
    actorId: actor.id,
    action: `user.invitation.${action}`,
    subjectType: 'UserInvitation',
    subjectId: id,
  });
  if (action === 'cancel') return safe({ ...row, status: 'CANCELLED' });
  return inviteUser({ name: row.name, email: row.email, roleIds: row.roleIds }, actor);
}
export async function verifyInvitation(token: string) {
  const row = await prisma.userInvitation.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
  });
  if (!row || row.status !== 'PENDING' || row.expiresAt.getTime() <= Date.now())
    throw new AppError('VALIDATION_ERROR', 400, 'Invitation is invalid or expired');
  return { name: row.name, email: row.email };
}
export async function activateInvitation(token: string, password: string) {
  const identity = await verifyInvitation(token);
  await assertNewPasswordAllowed(password, identity);
  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const row = await tx.userInvitation.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
    });
    if (!row || row.status !== 'PENDING' || row.expiresAt.getTime() <= Date.now())
      throw new AppError('VALIDATION_ERROR', 400, 'Invitation is invalid or expired');
    const claimed = await tx.userInvitation.updateMany({
      where: {
        id: row.id,
        tokenHash: hashRefreshToken(token),
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError('CONFLICT', 409, 'Invitation already consumed');
    if (await tx.user.findFirst({ where: { email: { equals: row.email, mode: 'insensitive' } } }))
      throw new AppError('CONFLICT', 409, 'This email already has an account');
    const roles = await tx.role.findMany({
      where: { id: { in: row.roleIds } },
      select: { id: true, name: true },
    });
    if (roles.length !== row.roleIds.length)
      throw new AppError('CONFLICT', 409, 'Invitation roles changed; request a new invitation');
    const client = roles.some((r) => r.name === 'CLIENT')
      ? await tx.client.create({ data: { companyName: row.name, email: row.email } })
      : null;
    const created = await tx.user.create({
      data: {
        email: row.email,
        name: row.name,
        passwordHash,
        isActive: true,
        clientId: client?.id,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
        ...(roles.some((r) => r.name === 'ENGINEER')
          ? { engineerProfile: { create: { status: 'ACTIVE' } } }
          : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: created.id,
        action: 'user.invitation.activated',
        subjectType: 'User',
        subjectId: created.id,
      },
    });
    return created;
  });
  await sendMail({ to: user.email, template: ACCOUNT_ACTIVATED_V1, vars: { name: user.name } });
  return { ok: true };
}
