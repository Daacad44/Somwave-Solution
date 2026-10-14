import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    role: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    engineerProfile: { update: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));
vi.mock('../lib/password', () => ({ hashPassword: vi.fn().mockResolvedValue('hashed') }));
vi.mock('../lib/password-policy', () => ({ assertNewPasswordAllowed: vi.fn() }));

import { prisma } from '../lib/prisma';
import { createUser, updateUser, deactivateUser, listUsers } from './user.service';
import { AppError } from '../lib/http';
import type { AuthUser } from '@somwave/shared';

const admin: AuthUser = {
  id: 'admin_1',
  name: 'Admin',
  email: 'admin@example.com',
  roles: ['ADMIN'],
  permissions: [],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};

const row = {
  id: 'usr_1',
  email: 'cali@example.com',
  name: 'Cali',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  roles: [{ role: { name: 'ADMIN' } }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createUser', () => {
  it('creates a user, validating roles and hashing the password', async () => {
    vi.mocked(prisma.role.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.create).mockResolvedValue(row as never);

    const result = await createUser(
      {
        email: 'cali@example.com',
        name: 'Cali',
        password: 'a-strong-password',
        roleIds: ['role_1'],
      },
      admin,
    );

    expect(result).toEqual({
      id: 'usr_1',
      email: 'cali@example.com',
      name: 'Cali',
      isActive: true,
      roles: ['ADMIN'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(prisma.user.create).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate email with CONFLICT', async () => {
    vi.mocked(prisma.role.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as never);

    await expect(
      createUser(
        {
          email: 'cali@example.com',
          name: 'Cali',
          password: 'a-strong-password',
          roleIds: [],
        },
        admin,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown role id', async () => {
    vi.mocked(prisma.role.count).mockResolvedValue(0 as never);

    await expect(
      createUser(
        {
          email: 'cali@example.com',
          name: 'Cali',
          password: 'a-strong-password',
          roleIds: ['ghost'],
        },
        admin,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('prevents an administrator from assigning SUPER_ADMIN to a new user', async () => {
    vi.mocked(prisma.role.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: 'super_role' } as never);
    await expect(
      createUser(
        {
          email: 'super@example.com',
          name: 'Super',
          password: 'a-strong-password',
          roleIds: ['super_role'],
        },
        admin,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('updateUser', () => {
  it('throws NOT_FOUND when the user is missing', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    await expect(updateUser('missing', { name: 'X' }, admin)).rejects.toBeInstanceOf(AppError);
  });

  it('revokes sessions when a user is deactivated', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'usr_1', roles: [] } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...row, isActive: false } as never);

    await updateUser('usr_1', { isActive: false }, admin);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'usr_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('blocks generic reactivation of a suspended engineer', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'usr_1',
      roles: [],
      engineerProfile: { status: 'SUSPENDED' },
    } as never);
    await expect(updateUser('usr_1', { isActive: true }, admin)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses to suspend the acting administrator', async () => {
    await expect(updateUser(admin.id, { isActive: false }, admin)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('prevents an administrator from editing a super administrator', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'usr_1',
      roles: [{ role: { name: 'SUPER_ADMIN' } }],
    } as never);
    await expect(updateUser('usr_1', { name: 'Changed' }, admin)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('prevents an administrator from assigning SUPER_ADMIN to themselves', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: admin.id,
      roles: [{ role: { name: 'ADMIN' } }],
    } as never);
    vi.mocked(prisma.role.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: 'super_role' } as never);
    await expect(updateUser(admin.id, { roleIds: ['super_role'] }, admin)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('deactivateUser', () => {
  it('refuses to deactivate the acting user', async () => {
    await expect(deactivateUser(admin.id, admin)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('soft-deletes another user and revokes their sessions', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'usr_2', roles: [] } as never);

    await deactivateUser('usr_2', admin);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});

describe('listUsers', () => {
  it('clamps the page size and maps rows to the admin shape', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([row] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1 as never);

    const result = await listUsers({ page: 1, pageSize: 500 });

    expect(result.pageSize).toBe(100); // MAX_PAGE_SIZE
    expect(result.items[0]?.roles).toEqual(['ADMIN']);
    expect(result.total).toBe(1);
  });
});
