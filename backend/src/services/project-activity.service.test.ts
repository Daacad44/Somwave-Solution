import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    task: { findMany: vi.fn() },
    milestone: { findMany: vi.fn() },
    projectDocumentation: { findMany: vi.fn() },
    bugReport: { findMany: vi.fn() },
    maintenanceRequest: { findMany: vi.fn() },
    projectExpense: { findMany: vi.fn() },
    projectInvitation: { findMany: vi.fn() },
    projectAssignmentEvent: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
import { prisma } from '../lib/prisma';
import { getProjectActivity } from './project-activity.service';

const engineer: AuthUser = {
  id: 'engineer',
  name: 'Engineer',
  email: 'engineer@example.com',
  roles: ['ENGINEER'],
  permissions: [],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of [
    prisma.task,
    prisma.milestone,
    prisma.projectDocumentation,
    prisma.bugReport,
    prisma.maintenanceRequest,
    prisma.projectExpense,
    prisma.projectInvitation,
    prisma.projectAssignmentEvent,
  ]) {
    vi.mocked(table.findMany).mockResolvedValue([] as never);
  }
  vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);
});

describe('project activity', () => {
  it('does not query activity when the project is outside the engineer scope', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
    await expect(getProjectActivity('private', engineer)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  it('returns only project-linked audit and assignment events with actor names', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'project' } as never);
    vi.mocked(prisma.task.findMany).mockResolvedValue([{ id: 'task' }] as never);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: 'audit',
        action: 'task.update',
        subjectType: 'Task',
        subjectId: 'task',
        actorId: 'engineer',
        createdAt: new Date('2026-10-15'),
      },
    ] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'engineer', name: 'Engineer' },
    ] as never);
    const result = await getProjectActivity('project', engineer);
    expect(result).toMatchObject([
      { action: 'task.update', actorName: 'Engineer', resourceId: 'task' },
    ]);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { subjectType: 'Project', subjectId: 'project' },
            { subjectType: 'Task', subjectId: { in: ['task'] } },
          ]),
        }),
      }),
    );
  });
});
