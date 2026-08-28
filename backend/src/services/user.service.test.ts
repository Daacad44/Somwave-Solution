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
    role: { count: vi.fn(), findMany: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));
vi.mock('../lib/password', () => ({ hashPassword: vi.fn().mockResolvedValue('hashed') }));

import { prisma } from '../lib/prisma';
import { createUser, updateUser, deactivateUser, listUsers } from './user.service';
import { AppError } from '../lib/http';

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

    const result = await createUser({
      email: 'cali@example.com',
      name: 'Cali',
      password: 'a-strong-password',
      roleIds: ['role_1'],
    });

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
      createUser({
        email: 'cali@example.com',
        name: 'Cali',
        password: 'a-strong-password',
        roleIds: [],
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown role id', async () => {
    vi.mocked(prisma.role.count).mockResolvedValue(0 as never);

    await expect(
      createUser({
        email: 'cali@example.com',
        name: 'Cali',
        password: 'a-strong-password',
        roleIds: ['ghost'],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('updateUser', () => {
  it('throws NOT_FOUND when the user is missing', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    await expect(updateUser('missing', { name: 'X' })).rejects.toBeInstanceOf(AppError);
  });

  it('revokes sessions when a user is deactivated', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'usr_1' } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...row, isActive: false } as never);

    await updateUser('usr_1', { isActive: false });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'usr_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('deactivateUser', () => {
  it('refuses to deactivate the acting user', async () => {
    await expect(deactivateUser('usr_1', 'usr_1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('soft-deletes another user and revokes their sessions', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'usr_2' } as never);

    await deactivateUser('usr_2', 'usr_1');

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
