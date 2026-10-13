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
    user: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    role: { findUnique: vi.fn() },
    projectInvitation: { findFirst: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    gitHubTaskLink: { findMany: vi.fn() },
    projectAssignmentEvent: { create: vi.fn() },
    milestone: { findFirst: vi.fn() },
    task: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    taskReview: { create: vi.fn() },
    taskDependency: { findMany: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  },
}));
vi.mock('./notification-delivery.service', () => ({ emitNotification: vi.fn() }));
vi.mock('../lib/mailer', () => ({ sendMail: vi.fn() }));
vi.mock('../lib/password', () => ({ hashPassword: vi.fn().mockResolvedValue('hashed-password') }));

import { prisma } from '../lib/prisma';
import { emitNotification } from './notification-delivery.service';
import { sendMail } from '../lib/mailer';
import { env } from '../lib/env';
import {
  createEngineeringTask,
  reviewEngineeringTask,
  listProjectEngineeringTasks,
  inviteProjectEngineer,
  respondToProjectInvitation,
  reassignProjectTasks,
  scheduleTask,
  verifyTaskQa,
  updateProjectMember,
} from './engineering.service';

const engineer = { id: 'user_1', roles: ['STAFF'] };
const manager = { id: 'manager_1', roles: ['MANAGER'] };
const project = { id: 'project_1', name: 'Private project', managerId: manager.id };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findFirst).mockResolvedValue(project as never);
  vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
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

describe('project engineer invitations', () => {
  it('queues a required email without granting project membership before acceptance', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: engineer.id,
      email: 'engineer@example.com',
      name: 'Engineer',
    } as never);
    vi.mocked(prisma.projectInvitation.upsert).mockResolvedValue({
      id: 'invitation_1',
      invitedAt: new Date('2026-10-12T00:00:00Z'),
    } as never);
    const result = await inviteProjectEngineer(project.id, manager, {
      email: 'engineer@example.com',
      role: 'ENGINEER',
    });
    expect(result.status).toBe('PENDING');
    expect(prisma.projectMember.upsert).not.toHaveBeenCalled();
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'project.assignment',
        userId: engineer.id,
        requiredEmail: true,
      }),
    );
  });

  it('rejects an existing active member instead of sending a second invitation', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: engineer.id } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      removedAt: null,
      role: 'ENGINEER',
    } as never);
    await expect(
      inviteProjectEngineer(project.id, manager, {
        email: 'engineer@example.com',
        role: 'ENGINEER',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.projectInvitation.upsert).not.toHaveBeenCalled();
  });

  it('invites an existing viewer without upgrading access before acceptance', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: engineer.id,
      email: 'engineer@example.com',
    } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      removedAt: null,
      role: 'VIEWER',
    } as never);
    vi.mocked(prisma.projectInvitation.upsert).mockResolvedValue({
      id: 'invitation_3',
      invitedAt: new Date('2026-10-12T00:00:00Z'),
    } as never);
    await inviteProjectEngineer(project.id, manager, {
      email: 'engineer@example.com',
      role: 'ENGINEER',
    });
    expect(prisma.projectMember.upsert).not.toHaveBeenCalled();
    expect(prisma.projectInvitation.upsert).toHaveBeenCalled();
  });

  it('rejects a direct viewer-to-engineer role upgrade', async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: 'membership_1',
      role: 'VIEWER',
      removedAt: null,
    } as never);
    await expect(
      updateProjectMember(project.id, engineer.id, manager, { role: 'ENGINEER' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.projectMember.update).not.toHaveBeenCalled();
  });

  it('does not create a new account when setup email is unavailable', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    await expect(
      inviteProjectEngineer(project.id, manager, {
        email: 'new-engineer@example.com',
        name: 'New Engineer',
        role: 'ENGINEER',
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates a new engineer account and sends a password setup email before inviting', async () => {
    const old = {
      SMTP_HOST: env.SMTP_HOST,
      SMTP_FROM: env.SMTP_FROM,
      APP_PUBLIC_URL: env.APP_PUBLIC_URL,
    };
    env.SMTP_HOST = 'smtp.example.test';
    env.SMTP_FROM = 'team@example.test';
    env.APP_PUBLIC_URL = 'https://app.example.test';
    try {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.role.findUnique).mockResolvedValue({ id: 'engineer_role' } as never);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: engineer.id,
        email: 'new-engineer@example.com',
        name: 'New Engineer',
      } as never);
      vi.mocked(sendMail).mockResolvedValue({ sent: true });
      vi.mocked(prisma.projectInvitation.upsert).mockResolvedValue({
        id: 'invitation_2',
        invitedAt: new Date('2026-10-12T00:00:00Z'),
      } as never);
      const result = await inviteProjectEngineer(project.id, manager, {
        email: 'new-engineer@example.com',
        name: 'New Engineer',
        role: 'ENGINEER',
      });
      expect(result.status).toBe('PENDING');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roles: { create: { roleId: 'engineer_role' } },
            passwordResets: { create: expect.objectContaining({ tokenHash: expect.any(String) }) },
          }),
        }),
      );
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new-engineer@example.com',
          template: 'engineer-account-invite.v1',
          vars: expect.objectContaining({
            setupUrl: expect.stringContaining('/reset-password?token='),
          }),
        }),
      );
    } finally {
      env.SMTP_HOST = old.SMTP_HOST;
      env.SMTP_FROM = old.SMTP_FROM;
      env.APP_PUBLIC_URL = old.APP_PUBLIC_URL;
    }
  });

  it('removes a newly created account when the setup email cannot be sent', async () => {
    const old = {
      SMTP_HOST: env.SMTP_HOST,
      SMTP_FROM: env.SMTP_FROM,
      APP_PUBLIC_URL: env.APP_PUBLIC_URL,
    };
    env.SMTP_HOST = 'smtp.example.test';
    env.SMTP_FROM = 'team@example.test';
    env.APP_PUBLIC_URL = 'https://app.example.test';
    try {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.role.findUnique).mockResolvedValue({ id: 'engineer_role' } as never);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: engineer.id,
        email: 'new-engineer@example.com',
      } as never);
      vi.mocked(prisma.projectInvitation.upsert).mockResolvedValue({
        id: 'invitation_2',
        invitedAt: new Date(),
      } as never);
      vi.mocked(sendMail).mockResolvedValue({ sent: false, reason: 'error' } as never);
      await expect(
        inviteProjectEngineer(project.id, manager, {
          email: 'new-engineer@example.com',
          name: 'New Engineer',
          role: 'ENGINEER',
        }),
      ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(prisma.projectInvitation.upsert).toHaveBeenCalled();
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: engineer.id } });
      expect(emitNotification).not.toHaveBeenCalled();
    } finally {
      env.SMTP_HOST = old.SMTP_HOST;
      env.SMTP_FROM = old.SMTP_FROM;
      env.APP_PUBLIC_URL = old.APP_PUBLIC_URL;
    }
  });

  it('allows only the invited user to accept and creates membership atomically', async () => {
    vi.mocked(prisma.projectInvitation.findFirst).mockResolvedValue({
      id: 'invitation_1',
      userId: engineer.id,
      projectId: project.id,
      role: 'ENGINEER',
      responsibilities: null,
    } as never);
    vi.mocked(prisma.projectInvitation.updateMany).mockResolvedValue({ count: 1 } as never);
    const result = await respondToProjectInvitation('invitation_1', engineer, {
      decision: 'ACCEPT',
    });
    expect(result.status).toBe('ACCEPTED');
    expect(prisma.projectInvitation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: engineer.id, status: 'PENDING' }),
    });
    expect(prisma.projectMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ projectId: project.id, userId: engineer.id }),
      }),
    );
  });

  it('does not grant membership when an invitation is declined', async () => {
    vi.mocked(prisma.projectInvitation.findFirst).mockResolvedValue({
      id: 'invitation_1',
      userId: engineer.id,
      projectId: project.id,
      role: 'ENGINEER',
    } as never);
    vi.mocked(prisma.projectInvitation.updateMany).mockResolvedValue({ count: 1 } as never);
    const result = await respondToProjectInvitation('invitation_1', engineer, {
      decision: 'DECLINE',
    });
    expect(result.status).toBe('DECLINED');
    expect(prisma.projectMember.upsert).not.toHaveBeenCalled();
  });
});

describe('project task reassignment', () => {
  it('requires both engineers to be active members of the same project', async () => {
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([{ userId: engineer.id }] as never);
    await expect(
      reassignProjectTasks(project.id, manager, {
        fromUserId: engineer.id,
        toUserId: 'outside_project',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('moves only unfinished tasks belonging to the selected project', async () => {
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([
      { userId: engineer.id },
      { userId: 'engineer_2' },
    ] as never);
    vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 2 } as never);
    const result = await reassignProjectTasks(project.id, manager, {
      fromUserId: engineer.id,
      toUserId: 'engineer_2',
    });
    expect(result.reassignedCount).toBe(2);
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: project.id,
        assigneeId: engineer.id,
        deletedAt: null,
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      data: { assigneeId: 'engineer_2' },
    });
  });
});

describe('dependency schedule constraints', () => {
  it('rejects a start date before its prerequisite finishes', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'task_1',
      projectId: project.id,
    } as never);
    vi.mocked(prisma.taskDependency.findMany)
      .mockResolvedValueOnce([
        { dependsOn: { title: 'Design', dueDate: new Date('2026-10-20T00:00:00Z') } },
      ] as never)
      .mockResolvedValueOnce([]);
    await expect(
      scheduleTask('task_1', manager, {
        startDate: '2026-10-19T00:00:00Z',
        dueDate: '2026-10-21T00:00:00Z',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});

describe('CI-gated QA', () => {
  it('refuses QA verification when a linked check failed', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'task_1',
      projectId: project.id,
      assigneeId: engineer.id,
      status: 'TESTING',
      approvalStatus: 'APPROVED',
    } as never);
    vi.mocked(prisma.gitHubTaskLink.findMany).mockResolvedValue([{ state: 'FAILURE' }] as never);
    await expect(verifyTaskQa('task_1', manager)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });
});
