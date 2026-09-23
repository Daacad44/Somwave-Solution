// Auth service — the only layer that touches Prisma for auth (SYSTEM_PROMPT §5).
// Access = JWT (15m); refresh = opaque token stored hashed, rotated on use,
// with reuse detection that kills every session for the user (§13).
// 2FA secrets are stored and verified here and are never logged.
import type { AuthUser } from '@somwave/shared';
import { isTwoFactorRequired } from '@somwave/shared';
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
  const permissions = [
    ...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((p) => p.key))),
  ];
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
  const valid = await verifyTotp(user.twoFactorSecret, code);
  if (!valid) {
    throw new AppError('UNAUTHORIZED', 401, 'Koodhka 2FA waa khalad');
  }
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

export async function confirmTwoFactorEnrolment(userId: string, code: string): Promise<AuthUser> {
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
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true },
    include: userWithRolesInclude,
  });
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

export { hashPassword };
