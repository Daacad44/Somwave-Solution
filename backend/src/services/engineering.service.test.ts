import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    projectMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    milestone: { findFirst: vi.fn() },
    task: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    taskReview: { create: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  },
}));
vi.mock('./notification-delivery.service', () => ({ emitNotification: vi.fn() }));

import { prisma } from '../lib/prisma';
import { emitNotification } from './notification-delivery.service';
import {
  createEngineeringTask,
  reviewEngineeringTask,
  listProjectEngineeringTasks,
} from './engineering.service';

const engineer = { id: 'user_1', roles: ['STAFF'] };
const manager = { id: 'manager_1', roles: ['MANAGER'] };
const project = { id: 'project_1', name: 'Private project', managerId: manager.id };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findFirst).mockResolvedValue(project as never);
});

describe('engineering project isolation', () => {
  it('blocks a user without active membership from listing a private project', async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    await expect(listProjectEngineeringTasks(project.id, engineer)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('blocks task creation when membership was removed', async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      role: 'ENGINEER',
      removedAt: new Date(),
    } as never);
    await expect(
      createEngineeringTask(project.id, engineer, {
        title: 'Private task',
        type: 'FEATURE',
        priority: 'MEDIUM',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('blocks links to a milestone in another project', async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      role: 'ENGINEER',
      removedAt: null,
    } as never);
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue(null);
    await expect(
      createEngineeringTask(project.id, engineer, {
        title: 'Private task',
        type: 'FEATURE',
        priority: 'MEDIUM',
        milestoneId: 'other_project_milestone',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.milestone.findFirst).toHaveBeenCalledWith({
      where: { id: 'other_project_milestone', projectId: project.id, deletedAt: null },
      select: { id: true },
    });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});

describe('independent review', () => {
  it('prevents the author from approving their own task even when they manage the project', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'task_1',
      projectId: project.id,
      reporterId: manager.id,
      reviewRequired: true,
      approvalStatus: 'SUBMITTED',
    } as never);
    await expect(
      reviewEngineeringTask('task_1', manager, { decision: 'APPROVE' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('records an independent approval in review history', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'task_1',
      projectId: project.id,
      reporterId: engineer.id,
      title: 'Private task',
      reviewRequired: true,
      approvalStatus: 'SUBMITTED',
    } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({
      id: 'task_1',
      approvalStatus: 'APPROVED',
    } as never);
    await reviewEngineeringTask('task_1', manager, { decision: 'APPROVE' });
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: 'task.review', userId: engineer.id }),
    );
    expect(prisma.taskReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: 'task_1',
        authorId: engineer.id,
        reviewerId: manager.id,
        status: 'APPROVED',
      }),
    });
  });
});
