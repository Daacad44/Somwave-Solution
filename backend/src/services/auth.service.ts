// Auth service — the only layer that touches Prisma for auth (SYSTEM_PROMPT §5).
// Access = JWT (15m); refresh = opaque token stored hashed, rotated on use,
// with reuse detection that kills every session for the user (§13).
// 2FA secrets are stored and verified here and are never logged.
import type { AuthUser } from '@somwave/shared';
import { isTwoFactorRequired, permissionKeysFor } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { hashPassword, verifyPassword } from '../lib/password';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiryDate,
  signAccessToken,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
} from '../lib/tokens';
import { createTotpSecret, totpUri, verifyTotp } from '../lib/totp';
import { logger } from '../lib/logger';
import { sendMail } from '../lib/mailer';
import { PASSWORD_RESET_V1 } from '../mail/templates';
import { env, corsOrigins } from '../lib/env';
import { randomBytes } from 'node:crypto';

export interface IssuedSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export type LoginResult =
  { kind: 'session'; session: IssuedSession } | { kind: 'twoFactor'; challengeToken: string };

type UserWithRoles = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  clientId: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  roles: { role: { name: string; permissions: { key: string }[] } }[];
};

const userWithRolesInclude = {
  roles: { include: { role: { include: { permissions: true } } } },
} as const;

function toAuthUser(user: UserWithRoles): AuthUser {
  const roles = user.roles.map((ur) => ur.role.name);
  const permissions = permissionKeysFor(
    roles,
    user.roles.flatMap((ur) => ur.role.permissions.map((p) => p.key)),
  );
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles,
    permissions,
    clientId: user.clientId,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorRequired: isTwoFactorRequired(roles),
  };
}

async function issueSession(user: UserWithRoles): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiryDate(),
    },
  });
  return { user: toAuthUser(user), accessToken: signAccessToken(user.id), refreshToken };
}

async function loadActiveUser(where: {
  id?: string;
  email?: string;
}): Promise<UserWithRoles | null> {
  return prisma.user.findFirst({
    where: { ...where, isActive: true, deletedAt: null },
    include: userWithRolesInclude,
  });
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await loadActiveUser({ email });
  // Verify against a real-looking hash even when the user is absent, so response
  // timing does not reveal whether the email exists.
  const hash = user?.passwordHash ?? '$2b$12$0000000000000000000000000000000000000000000000000000';
  const ok = await verifyPassword(password, hash);
  if (!user || !ok) {
    throw new AppError('UNAUTHORIZED', 401, 'Iimayl ama furaha waa khalad');
  }
  if (user.twoFactorEnabled) {
    return { kind: 'twoFactor', challengeToken: signTwoFactorChallenge(user.id) };
  }
  return { kind: 'session', session: await issueSession(user) };
}

export async function verifyTwoFactorLogin(
  challengeToken: string,
  code: string,
): Promise<IssuedSession> {
  let userId: string;
  try {
    userId = verifyTwoFactorChallenge(challengeToken).sub;
  } catch {
    throw new AppError('UNAUTHORIZED', 401, 'Fadlan mar kale gal');
  }
  const user = await loadActiveUser({ id: userId });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError('UNAUTHORIZED', 401, 'Fadlan mar kale gal');
  }
  const totpOk = await verifyTotp(user.twoFactorSecret, code);
  if (totpOk) return issueSession(user);
  const used = await consumeBackupCode(user.id, code);
  if (!used) throw new AppError('UNAUTHORIZED', 401, 'Koodhka 2FA waa khalad');
  return issueSession(user);
}

export async function startTwoFactorEnrolment(
  userId: string,
): Promise<{ otpauthUrl: string; secret: string }> {
  const user = await loadActiveUser({ id: userId });
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  if (user.twoFactorEnabled) {
    throw new AppError('CONFLICT', 409, '2FA hore ayaa loo shiday');
  }
  const secret = createTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });
  return { otpauthUrl: totpUri(user.email, secret), secret };
}

async function issueBackupCodes(userId: string): Promise<string[]> {
  const backupCodes = Array.from({ length: 8 }, () => randomBytes(4).toString('hex'));
  await prisma.$transaction([
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.twoFactorBackupCode.createMany({
      data: backupCodes.map((plain) => ({
        userId,
        codeHash: hashRefreshToken(plain),
      })),
    }),
  ]);
  return backupCodes;
}

export async function confirmTwoFactorEnrolment(
  userId: string,
  code: string,
): Promise<{ user: AuthUser; backupCodes: string[] }> {
  const user = await loadActiveUser({ id: userId });
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  if (user.twoFactorEnabled) {
    throw new AppError('CONFLICT', 409, '2FA hore ayaa loo shiday');
  }
  if (!user.twoFactorSecret) {
    throw new AppError('VALIDATION_ERROR', 400, 'Marka hore bilow diiwaangelinta 2FA');
  }
  const valid = await verifyTotp(user.twoFactorSecret, code);
  if (!valid) {
    throw new AppError('VALIDATION_ERROR', 400, 'Koodhka 2FA waa khalad');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true },
  });
  const backupCodes = await issueBackupCodes(user.id);
  const updated = await loadActiveUser({ id: user.id });
  if (!updated) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return { user: toAuthUser(updated), backupCodes };
}

async function assertCurrentTwoFactorCode(user: UserWithRoles, code: string): Promise<void> {
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError('VALIDATION_ERROR', 400, '2FA kuma shaqeynayo akoonkaagan');
  }
  const totpOk = await verifyTotp(user.twoFactorSecret, code);
  if (totpOk) return;
  const used = await consumeBackupCode(user.id, code);
  if (!used) throw new AppError('VALIDATION_ERROR', 400, 'Koodhka 2FA waa khalad');
}

export async function disableTwoFactor(userId: string, code: string): Promise<AuthUser> {
  const user = await loadActiveUser({ id: userId });
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  if (isTwoFactorRequired(user.roles.map((row) => row.role.name))) {
    throw new AppError('FORBIDDEN', 403, 'Doorkaagan wuxuu u baahan yahay 2FA');
  }
  await assertCurrentTwoFactorCode(user, code);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } }),
  ]);
  const updated = await loadActiveUser({ id: user.id });
  if (!updated) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return toAuthUser(updated);
}

export async function regenerateBackupCodes(
  userId: string,
  code: string,
): Promise<{ backupCodes: string[] }> {
  const user = await loadActiveUser({ id: userId });
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  await assertCurrentTwoFactorCode(user, code);
  return { backupCodes: await issueBackupCodes(user.id) };
}

export async function updateOwnProfile(userId: string, name: string): Promise<AuthUser> {
  const user = await loadActiveUser({ id: userId });
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  const updated = await loadActiveUser({ id: user.id });
  if (!updated) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return toAuthUser(updated);
}

export async function refreshSession(rawToken: string): Promise<IssuedSession> {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid session');
  }

  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn({ userId: existing.userId }, 'Refresh token reuse detected — all sessions revoked');
    throw new AppError('UNAUTHORIZED', 401, 'Session revoked');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new AppError('UNAUTHORIZED', 401, 'Session expired');
  }

  const user = await loadActiveUser({ id: existing.userId });
  if (!user) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid session');
  }

  const nextToken = generateRefreshToken();
  const nextHash = hashRefreshToken(nextToken);
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date(), replacedByTokenHash: nextHash },
    }),
    prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: nextHash, expiresAt: refreshExpiryDate() },
    }),
  ]);

  return { user: toAuthUser(user), accessToken: signAccessToken(user.id), refreshToken: nextToken };
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserAuthContext(userId: string): Promise<AuthUser | null> {
  const user = await loadActiveUser({ id: userId });
  return user ? toAuthUser(user) : null;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await loadActiveUser({ email });
  if (!user) return;
  const token = generateRefreshToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const base = env.APP_PUBLIC_URL ?? corsOrigins[0] ?? 'http://localhost:5173';
  await sendMail({
    to: user.email,
    template: PASSWORD_RESET_V1,
    vars: { resetUrl: `${base.replace(/\/$/, '')}/reset-password?token=${token}` },
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    throw new AppError('NOT_FOUND', 404, 'Xiriirka dib-u-dejinta waa dhacay');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const rows = await prisma.twoFactorBackupCode.findMany({
    where: { userId, usedAt: null },
  });
  const match = rows.find((row) => row.codeHash === hashRefreshToken(code.trim().toLowerCase()));
  if (!match) return false;
  await prisma.twoFactorBackupCode.update({
    where: { id: match.id },
    data: { usedAt: new Date() },
  });
  return true;
}

export { hashPassword };
