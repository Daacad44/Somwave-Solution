import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { prisma } from '../lib/prisma';
import { createProject, updateProject, deleteProject, listProjects } from './project.service';

const row = {
  id: 'prj_1',
  name: 'Website',
  description: null,
  status: 'PLANNING' as const,
  startDate: null,
  dueDate: null,
  budget: new Prisma.Decimal('25000.00'),
  clientId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  manager: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createProject', () => {
  it('creates a project and surfaces budget as a decimal string', async () => {
    vi.mocked(prisma.project.create).mockResolvedValue(row as never);

    const result = await createProject({ name: 'Website', status: 'PLANNING', budget: '25000.00' });

    expect(result.budget).toBe('25000');
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(prisma.project.create).toHaveBeenCalledOnce();
  });

  it('rejects an unknown manager id', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

    await expect(
      createProject({ name: 'Website', status: 'PLANNING', managerId: 'ghost' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });
});

describe('updateProject', () => {
  it('throws NOT_FOUND when the project is missing', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(updateProject('missing', { name: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('updates the status of an existing project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.project.update).mockResolvedValue({ ...row, status: 'ACTIVE' } as never);

    const result = await updateProject('prj_1', { status: 'ACTIVE' });
    expect(result.status).toBe('ACTIVE');
  });
});

describe('deleteProject', () => {
  it('soft-deletes an existing project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.project.update).mockResolvedValue({} as never);

    await deleteProject('prj_1');

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'prj_1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('throws NOT_FOUND when the project is missing', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(deleteProject('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('listProjects', () => {
  it('clamps the page size and maps rows', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([row] as never);
    vi.mocked(prisma.project.count).mockResolvedValue(1 as never);

    const result = await listProjects({ page: 1, pageSize: 500 });

    expect(result.pageSize).toBe(100);
    expect(result.items[0]?.budget).toBe('25000');
    expect(result.total).toBe(1);
  });
});
