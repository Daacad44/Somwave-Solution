// User & role management service (I1). The only layer that touches Prisma (§5).
// Every user shape returned here is the safe AdminUser projection — never the
// password hash or 2FA secret (§13).
import type { AdminUser, AdminRole, CreateUserInput, UpdateUserInput } from '@somwave/shared';
import { MAX_PAGE_SIZE } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { hashPassword } from '../lib/password';

const adminUserSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  createdAt: true,
  roles: { select: { role: { select: { name: true } } } },
} as const;

type UserRow = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  roles: { role: { name: string } }[];
};

function toAdminUser(row: UserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.isActive,
    roles: row.roles.map((ur) => ur.role.name),
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ListUsersParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface PagedUsers {
  items: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listUsers({ page, pageSize, search }: ListUsersParams): Promise<PagedUsers> {
  const take = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: rows.map(toAdminUser), page: Math.max(page, 1), pageSize: take, total };
}

export async function getUser(id: string): Promise<AdminUser | null> {
  const row = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: adminUserSelect,
  });
  return row ? toAdminUser(row) : null;
}

export function listRoles(): Promise<AdminRole[]> {
  return prisma.role.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, isSystem: true },
  });
}

// Rejects any roleId that does not exist, so a bad request never silently drops
// a role assignment.
async function assertRolesExist(roleIds: string[]): Promise<void> {
  if (roleIds.length === 0) return;
  const found = await prisma.role.count({ where: { id: { in: roleIds } } });
  if (found !== new Set(roleIds).size) {
    throw new AppError('VALIDATION_ERROR', 400, 'Hal ama in ka badan door lama helin');
  }
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  await assertRolesExist(input.roleIds);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('CONFLICT', 409, 'Iimaylkan horey ayaa loo isticmaalay');
  }

  const row = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
    },
    select: adminUserSelect,
  });
  return toAdminUser(row);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AdminUser> {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new AppError('NOT_FOUND', 404, 'Isticmaalahan lama helin');

  if (input.roleIds) await assertRolesExist(input.roleIds);

  const row = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.roleIds
        ? { roles: { deleteMany: {}, create: input.roleIds.map((roleId) => ({ roleId })) } }
        : {}),
    },
    select: adminUserSelect,
  });

  // Deactivating a user must end their sessions immediately (§13).
  if (input.isActive === false) {
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return toAdminUser(row);
}

// Soft delete — users are never hard-deleted (§7). Also revokes live sessions.
export async function deactivateUser(id: string, actingUserId: string): Promise<void> {
  if (id === actingUserId) {
    throw new AppError('VALIDATION_ERROR', 400, 'Iskama saari kartid akoonkaaga');
  }
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new AppError('NOT_FOUND', 404, 'Isticmaalahan lama helin');

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
