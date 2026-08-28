// Role & permission management service (I1.2). Only layer that touches Prisma (§5).
// SUPER_ADMIN is locked to the full permission set and is never edited here (§13).
import type { RoleDetail, Permission } from '@somwave/shared';
import { ROLES } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

const roleDetailSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  permissions: { select: { key: true } },
} as const;

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { key: string }[];
};

function toRoleDetail(row: RoleRow): RoleDetail {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: row.permissions.map((p) => p.key),
  };
}

export async function getRole(id: string): Promise<RoleDetail | null> {
  const row = await prisma.role.findUnique({ where: { id }, select: roleDetailSelect });
  return row ? toRoleDetail(row) : null;
}

export function listPermissions(): Promise<Permission[]> {
  return prisma.permission.findMany({
    orderBy: { key: 'asc' },
    select: { id: true, key: true, description: true },
  });
}

export async function setRolePermissions(
  id: string,
  permissionKeys: string[],
): Promise<RoleDetail> {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new AppError('NOT_FOUND', 404, 'Doorkan lama helin');

  // SUPER_ADMIN must always hold every permission — it is not editable (§13).
  if (role.name === ROLES.SUPER_ADMIN) {
    throw new AppError('FORBIDDEN', 403, 'SUPER_ADMIN lama beddeli karo — wuxuu haystaa dhammaan');
  }

  const unique = [...new Set(permissionKeys)];
  const found = await prisma.permission.findMany({
    where: { key: { in: unique } },
    select: { id: true, key: true },
  });
  if (found.length !== unique.length) {
    throw new AppError('VALIDATION_ERROR', 400, 'Hal ama in ka badan rukhsad lama helin');
  }

  const updated = await prisma.role.update({
    where: { id },
    data: { permissions: { set: found.map((p) => ({ id: p.id })) } },
    select: roleDetailSelect,
  });
  return toRoleDetail(updated);
}
