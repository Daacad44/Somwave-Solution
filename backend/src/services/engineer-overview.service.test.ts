import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    projectMember: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    engineerProgressReport: { findMany: vi.fn() },
    taskTimeEntry: { findMany: vi.fn() },
    maintenanceRequest: { findMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { getEngineerOperationalOverview } from './engineer-overview.service';

describe('engineer operational overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'engineer' } as never);
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([]);
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);
    vi.mocked(prisma.engineerProgressReport.findMany).mockResolvedValue([]);
    vi.mocked(prisma.taskTimeEntry.findMany).mockResolvedValue([]);
    vi.mocked(prisma.maintenanceRequest.findMany).mockResolvedValue([]);
  });

  it('does not disclose an engineer from a project the manager cannot manage', async () => {
    await expect(
      getEngineerOperationalOverview('engineer', { id: 'manager', roles: ['MANAGER'] }),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.projectMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'engineer',
          removedAt: null,
          project: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      }),
    );
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('queries every accepted visible project and computes totals from persisted records', async () => {
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([
      { projectId: 'p1' },
      { projectId: 'p2' },
    ] as never);
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      {
        id: 't1',
        title: 'Fix API',
        projectId: 'p1',
        status: 'IN_PROGRESS',
        dueDate: new Date('2020-01-01'),
        estimatedHours: 5,
        progressPercent: 40,
        project: { name: 'One' },
      },
      {
        id: 't2',
        title: 'Deploy',
        projectId: 'p2',
        status: 'DONE',
        dueDate: null,
        estimatedHours: 2,
        progressPercent: 100,
        project: { name: 'Two' },
      },
    ] as never);
    vi.mocked(prisma.taskTimeEntry.findMany).mockResolvedValue([
      {
        id: 'e1',
        taskId: 't1',
        minutes: 45,
        date: new Date('2026-10-13'),
        task: { title: 'Fix API', projectId: 'p1', project: { name: 'One' } },
      },
    ] as never);
    const result = await getEngineerOperationalOverview('engineer', {
      id: 'admin',
      roles: ['ADMIN'],
    });
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: { in: ['p1', 'p2'] }, assigneeId: 'engineer' }),
      }),
    );
    expect(result.summary).toMatchObject({
      activeTasks: 1,
      completedTasks: 1,
      overdueTasks: 1,
      openEstimateHours: 5,
      trackedMinutes: 45,
    });
  });
});
