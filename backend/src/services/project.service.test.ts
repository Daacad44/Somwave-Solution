import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { PERMISSIONS, type AuthUser } from '@somwave/shared';

const transactionMocks = vi.hoisted(() => ({
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  auditCreate: vi.fn().mockResolvedValue({}),
}));

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
    task: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    milestone: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    projectMember: { findMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((ops: unknown[] | ((tx: unknown) => unknown)) =>
      typeof ops === 'function'
        ? ops({
            project: { updateMany: transactionMocks.updateMany },
            auditLog: { create: transactionMocks.auditCreate },
          })
        : Promise.all(ops),
    ),
  },
}));

import { prisma } from '../lib/prisma';
import {
  createProject,
  deriveProjectHealth,
  deriveProjectHealthDetails,
  deriveProgress,
  updateProject,
  deleteProject,
  listProjects,
  getProjectWorkspace,
  updateProjectHealthNote,
  getProjectPortfolio,
} from './project.service';

const admin: AuthUser = {
  id: 'admin_1',
  name: 'Admin',
  email: 'admin@example.com',
  roles: ['ADMIN'],
  permissions: [PERMISSIONS.PROJECTS_UPDATE],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};
const viewer: AuthUser = { ...admin, id: 'viewer_1', roles: ['MANAGER'] };

const row = {
  id: 'prj_1',
  name: 'Website',
  description: null,
  status: 'PLANNING' as const,
  priority: 'MEDIUM' as const,
  startDate: null,
  dueDate: null,
  budget: new Prisma.Decimal('25000.00'),
  clientId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  manager: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  transactionMocks.updateMany.mockResolvedValue({ count: 1 });
});

describe('createProject', () => {
  it('creates a project and surfaces budget as a decimal string', async () => {
    vi.mocked(prisma.project.create).mockResolvedValue(row as never);

    const result = await createProject({
      name: 'Website',
      status: 'PLANNING',
      priority: 'MEDIUM',
      budget: '25000.00',
    });

    expect(result.budget).toBe('25000');
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(prisma.project.create).toHaveBeenCalledOnce();
  });

  it('rejects an unknown manager id', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

    await expect(
      createProject({
        name: 'Website',
        status: 'PLANNING',
        priority: 'MEDIUM',
        managerId: 'ghost',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('does not assign a suspended user as project manager', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    await expect(
      createProject({
        name: 'Website',
        status: 'PLANNING',
        priority: 'MEDIUM',
        managerId: 'suspended',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'suspended', isActive: true, deletedAt: null } }),
    );
  });
});

describe('project portfolio', () => {
  it('derives portfolio KPIs and filters from scoped project, task and membership data', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { ...row, id: 'late', status: 'ACTIVE', dueDate: new Date('2020-01-01'), client: null },
      { ...row, id: 'finished', name: 'Finished', status: 'COMPLETED', client: null },
    ] as never);
    vi.mocked(prisma.task.groupBy)
      .mockResolvedValueOnce([
        { projectId: 'late', status: 'TODO', _count: { _all: 2 } },
        { projectId: 'late', status: 'DONE', _count: { _all: 1 } },
      ] as never)
      .mockResolvedValueOnce([{ projectId: 'late', _count: { _all: 1 } }] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.milestone.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([
      { projectId: 'late', userId: 'engineer', user: { name: 'Engineer' } },
    ] as never);
    const result = await getProjectPortfolio({
      actor: viewer,
      page: 1,
      pageSize: 20,
      health: 'OVERDUE',
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'late',
      health: 'OVERDUE',
      progress: 33,
      assignedEngineers: 1,
    });
    expect(result.summary).toMatchObject({
      totalProjects: 2,
      completedProjects: 1,
      delayedProjects: 1,
      assignedEngineers: 1,
      overdueTasks: 1,
    });
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });
});

describe('updateProject', () => {
  it('throws NOT_FOUND when the project is missing', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(updateProject('missing', { name: 'X' }, admin)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('updates the status of an existing project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.project.update).mockResolvedValue({ ...row, status: 'ACTIVE' } as never);

    const result = await updateProject('prj_1', { status: 'ACTIVE' }, admin);
    expect(result.status).toBe('ACTIVE');
  });

  it('requires budget changes to use the revision action', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ ...row, managerId: admin.id } as never);
    await expect(updateProject('prj_1', { budget: '30000.00' }, admin)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('does not allow a global manager with viewer membership to change another project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(updateProject('prj_1', { budget: '100.00' }, viewer)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
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
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});

describe('deleteProject', () => {
  it('soft-deletes an existing project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.project.update).mockResolvedValue({} as never);

    await deleteProject('prj_1', admin);

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'prj_1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('throws NOT_FOUND when the project is missing', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(deleteProject('missing', admin)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('getProjectWorkspace', () => {
  it('requires the same project scope as the project detail endpoint', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(getProjectWorkspace('private_1', { actor: viewer })).resolves.toBeNull();
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'private_1', OR: expect.any(Array) }),
      }),
    );
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('derives delayed status from milestones, tasks and dependencies beyond the displayed page', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      ...row,
      healthNote: 'Waiting for client review',
      client: null,
    } as never);
    vi.mocked(prisma.task.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.milestone.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.task.count)
      .mockResolvedValueOnce(120 as never)
      .mockResolvedValueOnce(25 as never)
      .mockResolvedValueOnce(5 as never)
      .mockResolvedValueOnce(3 as never)
      .mockResolvedValueOnce(2 as never)
      .mockResolvedValueOnce(4 as never);
    vi.mocked(prisma.milestone.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([] as never);

    const result = await getProjectWorkspace('prj_1', { actor: admin });
    expect(result?.health).toBe('OVERDUE');
    expect(result?.healthReasons).toEqual(
      expect.arrayContaining([
        { code: 'MILESTONES_OVERDUE', count: 1 },
        { code: 'TASKS_OVERDUE', count: 3 },
        { code: 'TASKS_BLOCKED', count: 2 },
        { code: 'DEPENDENCIES_BLOCKED', count: 4 },
      ]),
    );
    expect(result?.taskCounts.total).toBe(120);
    expect(result?.healthNote).toBe('Waiting for client review');
    expect(result?.canEditHealthNote).toBe(true);
  });

  it('does not disclose internal manager context to clients', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      ...row,
      healthNote: 'Internal staffing concern',
      client: null,
    } as never);
    vi.mocked(prisma.task.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.milestone.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.task.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.milestone.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([] as never);
    const result = await getProjectWorkspace('prj_1', { clientId: 'client_1' });
    expect(result?.healthNote).toBeNull();
    expect(result?.canEditHealthNote).toBe(false);
    expect(result?.project.budget).toBeNull();
    expect(result?.tasks).toEqual([]);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [] } }),
      }),
    );
    expect(prisma.milestone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientVisible: true }),
      }),
    );
  });
});

describe('updateProjectHealthNote', () => {
  it('requires project manager scope and does not update an unowned project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(
      updateProjectHealthNote('prj_1', { note: 'Context' }, viewer),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('trims a manager note before saving', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'prj_1',
      healthNote: null,
    } as never);
    const result = await updateProjectHealthNote('prj_1', { note: '  Scope changed  ' }, admin);
    expect(result.note).toBe('Scope changed');
    expect(transactionMocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'prj_1', deletedAt: null },
      data: { healthNote: 'Scope changed' },
    });
    expect(transactionMocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: admin.id, action: 'project.health_note.updated' }),
      }),
    );
  });

  it('rejects an update if manager access is revoked before the write', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'prj_1',
      healthNote: null,
    } as never);
    transactionMocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      updateProjectHealthNote('prj_1', { note: 'Context' }, viewer),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(transactionMocks.auditCreate).not.toHaveBeenCalled();
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

describe('deriveProgress', () => {
  it('returns null when there are no tasks', () => {
    expect(deriveProgress(0, 0)).toBeNull();
  });

  it('rounds completed tasks', () => {
    expect(deriveProgress(3, 1)).toBe(33);
  });
});

describe('deriveProjectHealth', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  it('marks a past due active project as overdue', () => {
    expect(deriveProjectHealth({ status: 'ACTIVE', dueDate: '2026-05-01T00:00:00Z', now })).toBe(
      'OVERDUE',
    );
  });

  it('marks a project due within a week as at risk', () => {
    expect(deriveProjectHealth({ status: 'ACTIVE', dueDate: '2026-06-04T00:00:00Z', now })).toBe(
      'AT_RISK',
    );
  });

  it('does not invent a health date for an undated project', () => {
    expect(deriveProjectHealth({ status: 'PLANNING', dueDate: null, now })).toBe('NO_DATE');
  });

  it('marks overdue work as delayed even without a project deadline', () => {
    expect(
      deriveProjectHealthDetails({ status: 'ACTIVE', dueDate: null, overdueTasks: 2, now }),
    ).toEqual({
      health: 'OVERDUE',
      reasons: [{ code: 'TASKS_OVERDUE', count: 2 }],
    });
  });

  it('marks blocked dependencies and team capacity as risks with explanations', () => {
    expect(
      deriveProjectHealthDetails({
        status: 'ACTIVE',
        dueDate: '2026-07-30T00:00:00Z',
        blockedDependencies: 1,
        constrainedEngineers: 2,
        remainingTasks: 5,
        now,
      }),
    ).toEqual({
      health: 'AT_RISK',
      reasons: [
        { code: 'DEPENDENCIES_BLOCKED', count: 1 },
        { code: 'CAPACITY_CONSTRAINED', count: 2 },
      ],
    });
  });

  it('gives closed project status precedence over stale risk signals', () => {
    expect(
      deriveProjectHealthDetails({
        status: 'COMPLETED',
        dueDate: '2026-05-01T00:00:00Z',
        overdueTasks: 3,
        now,
      }),
    ).toEqual({ health: 'COMPLETE', reasons: [] });
  });
});
