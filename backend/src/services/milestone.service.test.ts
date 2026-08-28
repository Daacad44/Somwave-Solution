import { describe, it, expect, vi, beforeEach } from 'vitest';

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createMilestone', () => {
  it('creates a milestone after validating the project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.milestone.create).mockResolvedValue(row as never);

    const result = await createMilestone(input);

    expect(result).toMatchObject({ id: 'ms_1', project: { id: 'prj_1', name: 'Website' } });
    expect(prisma.milestone.create).toHaveBeenCalledOnce();
  });

  it('stamps completedAt when created as COMPLETED', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.milestone.create).mockResolvedValue(row as never);

    await createMilestone({ ...input, status: 'COMPLETED' });

    const arg = vi.mocked(prisma.milestone.create).mock.calls[0]?.[0] as {
      data: { completedAt: Date | null };
    };
    expect(arg.data.completedAt).toBeInstanceOf(Date);
  });

  it('rejects an unknown project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);

    await expect(createMilestone(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.milestone.create).not.toHaveBeenCalled();
  });
});

describe('updateMilestone', () => {
  it('throws NOT_FOUND when the milestone is missing', async () => {
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue(null as never);
    await expect(updateMilestone('missing', { status: 'COMPLETED' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('stamps completedAt when moving to COMPLETED', async () => {
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue({
      id: 'ms_1',
      status: 'PENDING',
    } as never);
    vi.mocked(prisma.milestone.update).mockResolvedValue({ ...row, status: 'COMPLETED' } as never);

    await updateMilestone('ms_1', { status: 'COMPLETED' });

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

    await updateMilestone('ms_1', { status: 'IN_PROGRESS' });

    const arg = vi.mocked(prisma.milestone.update).mock.calls[0]?.[0] as {
      data: { completedAt?: Date | null };
    };
    expect(arg.data.completedAt).toBeNull();
  });
});

describe('deleteMilestone', () => {
  it('soft-deletes an existing milestone', async () => {
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue({ id: 'ms_1' } as never);
    vi.mocked(prisma.milestone.update).mockResolvedValue({} as never);

    await deleteMilestone('ms_1');

    expect(prisma.milestone.update).toHaveBeenCalledWith({
      where: { id: 'ms_1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe('listMilestones', () => {
  it('clamps the page size and maps rows', async () => {
    vi.mocked(prisma.milestone.findMany).mockResolvedValue([row] as never);
    vi.mocked(prisma.milestone.count).mockResolvedValue(1 as never);

    const result = await listMilestones({ page: 1, pageSize: 500 });

    expect(result.pageSize).toBe(100);
    expect(result.items[0]?.project.name).toBe('Website');
    expect(result.total).toBe(1);
  });
});
