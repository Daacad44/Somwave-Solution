// Auth service — the only layer that touches Prisma for auth (SYSTEM_PROMPT §5).
// Access = JWT (15m); refresh = opaque token stored hashed, rotated on use,
// with reuse detection that kills every session for the user (§13).
import type { AuthUser } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { hashPassword, verifyPassword } from '../lib/password';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiryDate,
  signAccessToken,
} from '../lib/tokens';
import { logger } from '../lib/logger';

export interface IssuedSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

type UserWithRoles = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
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
  return { id: user.id, email: user.email, name: user.name, roles, permissions };
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

export async function login(email: string, password: string): Promise<IssuedSession> {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true, deletedAt: null },
    include: userWithRolesInclude,
  });
  // Verify against a real-looking hash even when the user is absent, so response
  // timing does not reveal whether the email exists.
  const hash = user?.passwordHash ?? '$2b$12$0000000000000000000000000000000000000000000000000000';
  const ok = await verifyPassword(password, hash);
  if (!user || !ok) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid email or password');
  }
  return issueSession(user);
}

export async function refreshSession(rawToken: string): Promise<IssuedSession> {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid session');
  }

  // Reuse of an already-rotated (revoked) token → treat as compromise and revoke
  // every session for that user (§13).
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

  const user = await prisma.user.findFirst({
    where: { id: existing.userId, isActive: true, deletedAt: null },
    include: userWithRolesInclude,
  });
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

export async function getUserAuthContext(
  userId: string,
): Promise<{ id: string; roles: string[]; permissions: string[] } | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    include: userWithRolesInclude,
  });
  if (!user) return null;
  const { id, roles, permissions } = toAuthUser(user);
  return { id, roles, permissions };
}

// Exposed for the seed and future user-management service.
export { hashPassword };
