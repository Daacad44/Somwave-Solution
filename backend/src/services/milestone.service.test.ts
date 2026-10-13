import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthUser } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: {
    milestone: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    project: { findFirst: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { prisma } from '../lib/prisma';
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  listMilestones,
} from './milestone.service';

const row = {
  id: 'ms_1',
  title: 'Design sign-off',
  description: null,
  status: 'PENDING' as const,
  dueDate: null,
  completedAt: null,
  order: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  project: { id: 'prj_1', name: 'Website' },
};

const input = {
  projectId: 'prj_1',
  title: 'Design sign-off',
  status: 'PENDING' as const,
  order: 0,
};
const engineer: AuthUser = {
  id: 'engineer_1',
  name: 'Engineer',
  email: 'engineer@example.test',
  roles: ['ENGINEER'],
  permissions: [],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};
const admin: AuthUser = { ...engineer, id: 'admin_1', roles: ['ADMIN'] };
const viewer: AuthUser = { ...engineer, id: 'viewer_1', roles: ['MANAGER'] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createMilestone', () => {
  it('creates a milestone after validating the project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.milestone.create).mockResolvedValue(row as never);

    const result = await createMilestone(input, admin);

    expect(result).toMatchObject({ id: 'ms_1', project: { id: 'prj_1', name: 'Website' } });
    expect(prisma.milestone.create).toHaveBeenCalledOnce();
  });

  it('stamps completedAt when created as COMPLETED', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.milestone.create).mockResolvedValue(row as never);

    await createMilestone({ ...input, status: 'COMPLETED' }, admin);

    const arg = vi.mocked(prisma.milestone.create).mock.calls[0]?.[0] as {
      data: { completedAt: Date | null };
    };
    expect(arg.data.completedAt).toBeInstanceOf(Date);
  });

  it('rejects an unknown project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);

    await expect(createMilestone(input, admin)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.milestone.create).not.toHaveBeenCalled();
  });

  it('requires manager access even when the actor can view the project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(createMilestone(input, viewer)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { managerId: viewer.id },
            { members: { some: { userId: viewer.id, role: 'MANAGER', removedAt: null } } },
          ],
        }),
      }),
    );
    expect(prisma.milestone.create).not.toHaveBeenCalled();
  });
});

describe('updateMilestone', () => {
  it('throws NOT_FOUND when the milestone is missing', async () => {
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue(null as never);
    await expect(updateMilestone('missing', { status: 'COMPLETED' }, admin)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('stamps completedAt when moving to COMPLETED', async () => {
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue({
      id: 'ms_1',
      status: 'PENDING',
    } as never);
    vi.mocked(prisma.milestone.update).mockResolvedValue({ ...row, status: 'COMPLETED' } as never);

    await updateMilestone('ms_1', { status: 'COMPLETED' }, admin);

    const arg = vi.mocked(prisma.milestone.update).mock.calls[0]?.[0] as {
      data: { completedAt?: Date | null };
    };
    expect(arg.data.completedAt).toBeInstanceOf(Date);
  });

  it('clears completedAt when leaving COMPLETED', async () => {
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue({
      id: 'ms_1',
      status: 'COMPLETED',
    } as never);
    vi.mocked(prisma.milestone.update).mockResolvedValue({
      ...row,
      status: 'IN_PROGRESS',
    } as never);

    await updateMilestone('ms_1', { status: 'IN_PROGRESS' }, admin);

    const arg = vi.mocked(prisma.milestone.update).mock.calls[0]?.[0] as {
      data: { completedAt?: Date | null };
    };
    expect(arg.data.completedAt).toBeNull();
  });

  it('hides a milestone in an unmanaged project from mutation', async () => {
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue(null as never);
    await expect(updateMilestone('ms_1', { title: 'Changed' }, viewer)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prisma.milestone.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      }),
    );
    expect(prisma.milestone.update).not.toHaveBeenCalled();
  });
});

describe('deleteMilestone', () => {
  it('soft-deletes an existing milestone', async () => {
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue({ id: 'ms_1' } as never);
    vi.mocked(prisma.milestone.update).mockResolvedValue({} as never);

    await deleteMilestone('ms_1', admin);

    expect(prisma.milestone.update).toHaveBeenCalledWith({
      where: { id: 'ms_1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe('listMilestones', () => {
  it('scopes milestones to the actor’s assigned projects', async () => {
    vi.mocked(prisma.milestone.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.milestone.count).mockResolvedValue(0 as never);
    await listMilestones({ page: 1, pageSize: 20, actor: engineer });
    expect(prisma.milestone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: {
            OR: [
              { managerId: engineer.id },
              { members: { some: { userId: engineer.id, removedAt: null } } },
            ],
          },
        }),
      }),
    );
  });
  it('clamps the page size and maps rows', async () => {
    vi.mocked(prisma.milestone.findMany).mockResolvedValue([row] as never);
    vi.mocked(prisma.milestone.count).mockResolvedValue(1 as never);

    const result = await listMilestones({ page: 1, pageSize: 500 });

    expect(result.pageSize).toBe(100);
    expect(result.items[0]?.project.name).toBe('Website');
    expect(result.total).toBe(1);
  });
});
