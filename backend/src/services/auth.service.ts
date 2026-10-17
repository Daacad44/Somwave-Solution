// Auth service — the only layer that touches Prisma for auth (SYSTEM_PROMPT §5).
// Access = JWT (15m); refresh = opaque token stored hashed, rotated on use,
// with reuse detection that kills every session for the user (§13).
// 2FA secrets are stored and verified here and are never logged.
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '@somwave/shared';
import { isTwoFactorRequired, permissionKeysFor } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { hashPassword, verifyPassword } from '../lib/password';
import { assertNewPasswordAllowed } from '../lib/password-policy';
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
import { PASSWORD_RESET_CODE_V1, PASSWORD_CHANGED_V1 } from '../mail/templates';
import { env } from '../lib/env';
import { randomBytes, randomInt, createHmac, timingSafeEqual } from 'node:crypto';

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
  sessionsRevokedAt: Date | null;
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

async function issueSession(
  user: UserWithRoles,
  mfaVerifiedAt: Date | null = null,
  db: Prisma.TransactionClient = prisma,
): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();
  await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiryDate(),
      mfaVerifiedAt,
    },
  });
  return {
    user: toAuthUser(user),
    accessToken: signAccessToken(
      user.id,
      mfaVerifiedAt,
      Math.max(Date.now(), (user.sessionsRevokedAt?.getTime() ?? 0) + 1),
    ),
    refreshToken,
  };
}

async function loadActiveUser(
  where: {
    id?: string;
    email?: string;
  },
  db: Prisma.TransactionClient = prisma,
): Promise<UserWithRoles | null> {
  return db.user.findFirst({
    where: {
      ...where,
      ...(where.email
        ? { email: { equals: where.email.trim(), mode: 'insensitive' as const } }
        : {}),
      isActive: true,
      deletedAt: null,
      NOT: { engineerProfile: { is: { status: 'SUSPENDED' } } },
    },
    include: userWithRolesInclude,
  });
}

// All credential-based issuance shares password recovery's user-row lock.
// A reset that wins the lock invalidates credentials checked before it.
async function withCurrentCredentials<T>(
  snapshot: UserWithRoles,
  work: (current: UserWithRoles, tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: snapshot.id }, data: { updatedAt: new Date() } });
    const current = await loadActiveUser({ id: snapshot.id }, tx);
    if (
      !current ||
      current.passwordHash !== snapshot.passwordHash ||
      current.sessionsRevokedAt?.getTime() !== snapshot.sessionsRevokedAt?.getTime() ||
      current.twoFactorEnabled !== snapshot.twoFactorEnabled ||
      current.twoFactorSecret !== snapshot.twoFactorSecret
    )
      throw new AppError('UNAUTHORIZED', 401, 'Credentials changed; please sign in again');
    return work(current, tx);
  });
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await loadActiveUser({ email });
  // Verify against a real-looking hash even when the user is absent, so response
  // timing does not reveal whether the email exists.
  const hash = user?.passwordHash ?? '$2b$12$0000000000000000000000000000000000000000000000000000';
  const ok = await verifyPassword(password, hash);
  if (!user || !ok) {
    throw new AppError('UNAUTHORIZED', 401, 'Incorrect email or password');
  }
  return withCurrentCredentials(user, async (current, tx) => {
    if (current.twoFactorEnabled)
      return {
        kind: 'twoFactor' as const,
        challengeToken: signTwoFactorChallenge(
          current.id,
          Math.max(Date.now(), (current.sessionsRevokedAt?.getTime() ?? 0) + 1),
        ),
      };
    return { kind: 'session' as const, session: await issueSession(current, null, tx) };
  });
}

export async function verifyTwoFactorLogin(
  challengeToken: string,
  code: string,
): Promise<IssuedSession> {
  let userId: string;
  let issuedAt: number | undefined;
  try {
    const challenge = verifyTwoFactorChallenge(challengeToken);
    userId = challenge.sub;
    issuedAt = challenge.issuedAt;
  } catch {
    throw new AppError('UNAUTHORIZED', 401, 'Please sign in again');
  }
  const user = await loadActiveUser({ id: userId });
  if (
    !user?.twoFactorEnabled ||
    !user.twoFactorSecret ||
    (user.sessionsRevokedAt && (!issuedAt || issuedAt <= user.sessionsRevokedAt.getTime()))
  ) {
    throw new AppError('UNAUTHORIZED', 401, 'Please sign in again');
  }
  const totpOk = await verifyTotp(user.twoFactorSecret, code);
  if (totpOk)
    return withCurrentCredentials(user, (current, tx) => issueSession(current, new Date(), tx));
  return withCurrentCredentials(user, async (current, tx) => {
    const used = await consumeBackupCode(current.id, code, tx);
    if (!used) throw new AppError('UNAUTHORIZED', 401, 'Invalid 2FA code');
    return issueSession(current, new Date(), tx);
  });
}

export async function startTwoFactorEnrolment(
  userId: string,
): Promise<{ otpauthUrl: string; secret: string }> {
  const user = await loadActiveUser({ id: userId });
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  if (user.twoFactorEnabled) {
    throw new AppError('CONFLICT', 409, '2FA is already enabled');
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
    throw new AppError('CONFLICT', 409, '2FA is already enabled');
  }
  if (!user.twoFactorSecret) {
    throw new AppError('VALIDATION_ERROR', 400, 'Start 2FA enrollment first');
  }
  const valid = await verifyTotp(user.twoFactorSecret, code);
  if (!valid) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid 2FA code');
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
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Two-factor authentication is not enabled on your account',
    );
  }
  const totpOk = await verifyTotp(user.twoFactorSecret, code);
  if (totpOk) return;
  const used = await consumeBackupCode(user.id, code);
  if (!used) throw new AppError('VALIDATION_ERROR', 400, 'Invalid 2FA code');
}

export async function disableTwoFactor(userId: string, code: string): Promise<AuthUser> {
  const user = await loadActiveUser({ id: userId });
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  if (isTwoFactorRequired(user.roles.map((row) => row.role.name))) {
    throw new AppError('FORBIDDEN', 403, 'Your role requires 2FA');
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
  const observed = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  if (!observed) throw new AppError('UNAUTHORIZED', 401, 'Invalid session');
  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: observed.userId }, data: { updatedAt: new Date() } });
    const existing = await tx.refreshToken.findUnique({ where: { tokenHash } });
    const user = await loadActiveUser({ id: observed.userId }, tx);
    if (!existing || !user) throw new AppError('UNAUTHORIZED', 401, 'Invalid session');
    if (existing.revokedAt) {
      await tx.user.update({ where: { id: user.id }, data: { sessionsRevokedAt: new Date() } });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }
    if (existing.expiresAt.getTime() <= Date.now())
      throw new AppError('UNAUTHORIZED', 401, 'Session expired');
    const nextToken = generateRefreshToken();
    const nextHash = hashRefreshToken(nextToken);
    const consumed = await tx.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date(), replacedByTokenHash: nextHash },
    });
    if (consumed.count !== 1) throw new AppError('UNAUTHORIZED', 401, 'Session revoked');
    const mfaVerifiedAt = user.twoFactorEnabled ? existing.mfaVerifiedAt : null;
    await tx.refreshToken.create({
      data: { userId: user.id, tokenHash: nextHash, expiresAt: refreshExpiryDate(), mfaVerifiedAt },
    });
    return {
      user: toAuthUser(user),
      accessToken: signAccessToken(
        user.id,
        mfaVerifiedAt,
        Math.max(Date.now(), (user.sessionsRevokedAt?.getTime() ?? 0) + 1),
      ),
      refreshToken: nextToken,
    };
  });
  if (!result) {
    logger.warn({ userId: observed.userId }, 'Refresh token reuse detected — all sessions revoked');
    throw new AppError('UNAUTHORIZED', 401, 'Session revoked');
  }
  return result;
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserAuthContext(
  userId: string,
  issuedAt?: number,
): Promise<AuthUser | null> {
  const user = await loadActiveUser({ id: userId });
  if (user?.sessionsRevokedAt && (!issuedAt || issuedAt <= user.sessionsRevokedAt.getTime()))
    return null;
  return user ? toAuthUser(user) : null;
}

function resetCodeHash(userId: string, code: string) {
  return createHmac('sha256', env.JWT_SECRET)
    .update(`password-reset:${userId}:${code}`)
    .digest('hex');
}
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await loadActiveUser({ email: email.trim().toLowerCase() });
  if (!user) return;
  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60000) } },
  });
  if (recent) return;
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const reset = await prisma.$transaction(async (tx) => {
    // Serialize requests per account, including simultaneous resends.
    await tx.user.update({ where: { id: user.id }, data: { updatedAt: new Date() } });
    const last = await tx.passwordResetToken.findFirst({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60000) } },
    });
    if (last) return null;
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(generateRefreshToken()),
        codeHash: resetCodeHash(user.id, code),
        expiresAt: new Date(Date.now() + 10 * 60000),
      },
    });
  });
  if (!reset) return;
  const result = await sendMail({
    to: user.email,
    template: PASSWORD_RESET_CODE_V1,
    idempotencyKey: `password-reset-code:${reset.id}`,
    vars: { code },
  });
  if (!result.sent)
    await prisma.passwordResetToken.updateMany({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });
}
export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<{ token: string }> {
  const token = generateRefreshToken();
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        email: { equals: email.trim(), mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!user) return false;
    await tx.user.update({ where: { id: user.id }, data: { updatedAt: new Date() } });
    const row = await tx.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || !row.codeHash || row.attempts >= 5 || row.expiresAt.getTime() <= Date.now())
      return false;
    const valid = timingSafeEqual(
      Buffer.from(row.codeHash, 'hex'),
      Buffer.from(resetCodeHash(user.id, code), 'hex'),
    );
    await tx.passwordResetToken.update({
      where: { id: row.id },
      data: {
        attempts: { increment: 1 },
        ...(valid
          ? {
              verifiedAt: new Date(),
              codeHash: null,
              tokenHash: hashRefreshToken(token),
              expiresAt: new Date(Date.now() + 10 * 60000),
            }
          : {}),
      },
    });
    return valid;
  });
  if (!result) throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired verification code');
  return { token };
}
export async function resetPassword(token: string, password: string): Promise<void> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
  });
  if (!row || row.usedAt || !row.verifiedAt || row.expiresAt.getTime() <= Date.now())
    throw new AppError('VALIDATION_ERROR', 400, 'Password reset verification has expired');
  const user = await prisma.user.findFirst({
    where: { id: row.userId, isActive: true, deletedAt: null },
    select: { name: true, email: true },
  });
  if (!user) throw new AppError('VALIDATION_ERROR', 400, 'Password reset verification has expired');
  await assertNewPasswordAllowed(password, user);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: row.userId }, data: { updatedAt: new Date() } });
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null, verifiedAt: { not: null }, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1)
      throw new AppError('VALIDATION_ERROR', 400, 'Password reset verification has expired');
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, sessionsRevokedAt: new Date() },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: row.userId,
        action: 'auth.password.reset',
        subjectType: 'User',
        subjectId: row.userId,
      },
    });
  });
  await sendMail({ to: user.email, template: PASSWORD_CHANGED_V1, vars: { name: user.name } });
}

async function consumeBackupCode(
  userId: string,
  code: string,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  const rows = await db.twoFactorBackupCode.findMany({
    where: { userId, usedAt: null },
  });
  const match = rows.find((row) => row.codeHash === hashRefreshToken(code.trim().toLowerCase()));
  if (!match) return false;
  const claimed = await db.twoFactorBackupCode.updateMany({
    where: { id: match.id, userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return claimed.count === 1;
}

export { hashPassword };
