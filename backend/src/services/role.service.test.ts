import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    role: { findUnique: vi.fn(), update: vi.fn() },
    permission: { findMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { setRolePermissions, getRole } from './role.service';

const roleRow = {
  id: 'role_1',
  name: 'MANAGER',
  description: null,
  isSystem: true,
  permissions: [{ key: 'users.read' }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRole', () => {
  it('maps the role to its permission keys', async () => {
    vi.mocked(prisma.role.findUnique).mockResolvedValue(roleRow as never);
    const role = await getRole('role_1');
    expect(role).toMatchObject({ id: 'role_1', name: 'MANAGER', permissions: ['users.read'] });
  });
});

describe('setRolePermissions', () => {
  it('sets the validated permissions on a non-system-critical role', async () => {
    vi.mocked(prisma.role.findUnique).mockResolvedValue({ id: 'role_1', name: 'MANAGER' } as never);
    vi.mocked(prisma.permission.findMany).mockResolvedValue([
      { id: 'p1', key: 'users.read' },
      { id: 'p2', key: 'users.create' },
    ] as never);
    vi.mocked(prisma.role.update).mockResolvedValue({
      ...roleRow,
      permissions: [{ key: 'users.read' }, { key: 'users.create' }],
    } as never);

    const result = await setRolePermissions('role_1', ['users.read', 'users.create']);

    expect(result.permissions).toEqual(['users.read', 'users.create']);
    expect(prisma.role.update).toHaveBeenCalledOnce();
  });

  it('refuses to edit SUPER_ADMIN', async () => {
    vi.mocked(prisma.role.findUnique).mockResolvedValue({
      id: 'role_sa',
      name: 'SUPER_ADMIN',
    } as never);

    await expect(setRolePermissions('role_sa', [])).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.role.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown permission key', async () => {
    vi.mocked(prisma.role.findUnique).mockResolvedValue({ id: 'role_1', name: 'MANAGER' } as never);
    vi.mocked(prisma.permission.findMany).mockResolvedValue([] as never);

    await expect(setRolePermissions('role_1', ['ghost.perm'])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.role.update).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when the role is missing', async () => {
    vi.mocked(prisma.role.findUnique).mockResolvedValue(null as never);
    await expect(setRolePermissions('missing', [])).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
