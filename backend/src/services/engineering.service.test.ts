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
    user: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    role: { findUnique: vi.fn() },
    projectInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    projectHandover: { create: vi.fn(), findMany: vi.fn() },
    bugReport: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    maintenanceRequest: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    projectDocumentation: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    release: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    gitHubTaskLink: { findMany: vi.fn() },
    projectAssignmentEvent: { create: vi.fn() },
    milestone: { findFirst: vi.fn() },
    task: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    taskReview: { create: vi.fn() },
    taskDependency: { findMany: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  },
}));
vi.mock('./notification-delivery.service', () => ({ emitNotification: vi.fn() }));
vi.mock('./engineer-account.service', () => ({ ensureEngineerAccountForProjectInvite: vi.fn() }));

import { prisma } from '../lib/prisma';
import { emitNotification } from './notification-delivery.service';
import { ensureEngineerAccountForProjectInvite } from './engineer-account.service';
import {
  createEngineeringTask,
  reviewEngineeringTask,
  listProjectEngineeringTasks,
  inviteProjectEngineer,
  respondToProjectInvitation,
  reassignProjectTasks,
  createProjectHandover,
  removeProjectMember,
  scheduleTask,
  verifyTaskQa,
  updateProjectMember,
  listEligibleEngineers,
} from './engineering.service';

const engineer = { id: 'user_1', roles: ['STAFF'] };
const manager = { id: 'manager_1', roles: ['MANAGER'] };
const project = { id: 'project_1', name: 'Private project', managerId: manager.id };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findFirst).mockResolvedValue(project as never);
  vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
  vi.mocked(ensureEngineerAccountForProjectInvite).mockResolvedValue({
    id: engineer.id,
    email: 'engineer@example.com',
    name: 'Engineer',
  });
  vi.mocked(prisma.task.findMany).mockResolvedValue([]);
  vi.mocked(prisma.bugReport.findMany).mockResolvedValue([]);
  vi.mocked(prisma.maintenanceRequest.findMany).mockResolvedValue([]);
  vi.mocked(prisma.projectDocumentation.findMany).mockResolvedValue([]);
  vi.mocked(prisma.release.findMany).mockResolvedValue([]);
  vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.bugReport.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.maintenanceRequest.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.projectDocumentation.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.release.updateMany).mockResolvedValue({ count: 0 } as never);
});

describe('engineering project isolation', () => {
  it('keeps active-profile eligibility when searching and reports current-week capacity', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: 'engineer',
        name: 'Engineer',
        email: 'engineer@example.com',
        engineerProfile: { weeklyCapacityHours: 20, availability: 'AVAILABLE' },
        assignedTasks: [{ startDate: null, dueDate: null, estimatedHours: 19 }],
        availabilitySlots: [],
      },
    ] as never);
    const rows = await listEligibleEngineers(project.id, manager, 'engineer');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { OR: [{ engineerProfile: { is: null } }, { engineerProfile: { status: 'ACTIVE' } }] },
          ]),
        }),
      }),
    );
    expect(rows[0]).toMatchObject({
      weeklyCapacityHours: 20,
      estimatedOpenHours: 19,
      estimatedHoursThisWeek: 19,
      nearCapacity: true,
      overCapacity: false,
    });
  });
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
  it("allows an accepted project reviewer to review another engineer's submitted task", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      role: 'REVIEWER',
      removedAt: null,
    } as never);
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'task_1',
      projectId: project.id,
      reporterId: 'other_engineer',
      title: 'Private task',
      reviewRequired: true,
      approvalStatus: 'SUBMITTED',
    } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({
      id: 'task_1',
      approvalStatus: 'APPROVED',
    } as never);
    const reviewer = { id: engineer.id, roles: ['ENGINEER'] };
    await expect(
      reviewEngineeringTask('task_1', reviewer, { decision: 'APPROVE' }),
    ).resolves.toMatchObject({ approvalStatus: 'APPROVED' });
  });

  it('rejects a project contributor from reviewing submitted work', async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      role: 'CONTRIBUTOR',
      removedAt: null,
    } as never);
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'task_1',
      projectId: project.id,
      reporterId: 'other_engineer',
      reviewRequired: true,
      approvalStatus: 'SUBMITTED',
    } as never);
    await expect(
      reviewEngineeringTask('task_1', engineer, { decision: 'APPROVE' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

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
  const details = {
    email: 'engineer@example.com',
    role: 'ENGINEER' as const,
    description: 'Implement the project API',
    responsibilities: 'Build and test the API',
    startDate: '2026-10-14T09:00:00Z',
    expectedEndDate: '2026-11-14T09:00:00Z',
    estimatedHours: 80,
    priority: 'HIGH' as const,
  };

  it('creates a pending invitation and queues email without granting membership', async () => {
    vi.mocked(prisma.projectInvitation.upsert).mockResolvedValue({
      id: 'invitation_1',
      invitedAt: new Date('2026-10-12T00:00:00Z'),
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: engineer.id } as never);
    const result = await inviteProjectEngineer(project.id, manager, details);
    expect(result.status).toBe('PENDING');
    expect(prisma.projectMember.upsert).not.toHaveBeenCalled();
    expect(prisma.projectInvitation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ description: details.description, estimatedHours: 80 }),
      }),
    );
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'project.assignment',
        userId: engineer.id,
        requiredEmail: true,
      }),
    );
  });

  it('does not resend an unexpired pending invitation', async () => {
    vi.mocked(prisma.projectInvitation.findUnique).mockResolvedValue({
      id: 'invitation_1',
      status: 'PENDING',
      expiresAt: new Date('2099-01-01'),
    } as never);
    const result = await inviteProjectEngineer(project.id, manager, details);
    expect(result).toMatchObject({ duplicate: true, status: 'PENDING' });
    expect(prisma.projectInvitation.upsert).not.toHaveBeenCalled();
    expect(emitNotification).not.toHaveBeenCalled();
  });

  it('rejects an existing active engineer membership', async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      removedAt: null,
      role: 'ENGINEER',
    } as never);
    await expect(inviteProjectEngineer(project.id, manager, details)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.projectInvitation.upsert).not.toHaveBeenCalled();
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
  });

  it('rejects an expired invitation without granting access', async () => {
    vi.mocked(prisma.projectInvitation.findFirst).mockResolvedValue({
      id: 'invitation_1',
      userId: engineer.id,
      projectId: project.id,
      role: 'ENGINEER',
      status: 'PENDING',
      expiresAt: new Date('2020-01-01'),
    } as never);
    await expect(
      respondToProjectInvitation(
        'invitation_1',
        { id: engineer.id, roles: ['ENGINEER'] },
        { decision: 'ACCEPT' },
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.projectInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EXPIRED' }),
      }),
    );
    expect(prisma.projectMember.upsert).not.toHaveBeenCalled();
  });

  it('accepts only for an active engineer and creates membership atomically', async () => {
    vi.mocked(prisma.projectInvitation.findFirst).mockResolvedValue({
      id: 'invitation_1',
      userId: engineer.id,
      projectId: project.id,
      role: 'ENGINEER',
      status: 'PENDING',
      priority: 'MEDIUM',
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: engineer.id } as never);
    vi.mocked(prisma.projectInvitation.updateMany).mockResolvedValue({ count: 1 } as never);
    const result = await respondToProjectInvitation(
      'invitation_1',
      { id: engineer.id, roles: ['ENGINEER'] },
      { decision: 'ACCEPT' },
    );
    expect(result.status).toBe('ACCEPTED');
    expect(prisma.projectMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ projectId: project.id, userId: engineer.id }),
      }),
    );
  });

  it('does not create membership when declined', async () => {
    vi.mocked(prisma.projectInvitation.findFirst).mockResolvedValue({
      id: 'invitation_1',
      userId: engineer.id,
      projectId: project.id,
      role: 'ENGINEER',
      status: 'PENDING',
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: engineer.id } as never);
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

describe('project handover', () => {
  const handoverInput = {
    fromUserId: engineer.id,
    toUserId: 'engineer_2',
    removeSource: true,
    transferBugs: false,
    transferMaintenance: false,
    transferDocuments: false,
    transferReleases: false,
    notes: 'Transfer the active implementation and review queue.',
  };

  it('requires an accepted active replacement before transferring any work', async () => {
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([
      { id: 'source', userId: engineer.id, role: 'ENGINEER' },
    ] as never);
    await expect(createProjectHandover(project.id, manager, handoverInput)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
    expect(prisma.projectHandover.create).not.toHaveBeenCalled();
  });

  it('blocks removal when open maintenance has not been approved for transfer', async () => {
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([
      { id: 'source', userId: engineer.id, role: 'ENGINEER' },
      { id: 'target', userId: 'engineer_2', role: 'ENGINEER' },
    ] as never);
    vi.mocked(prisma.maintenanceRequest.findMany).mockResolvedValue([
      { id: 'maintenance_1' },
    ] as never);
    await expect(createProjectHandover(project.id, manager, handoverInput)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.projectMember.update).not.toHaveBeenCalled();
    expect(prisma.projectHandover.create).not.toHaveBeenCalled();
  });

  it('records a checklist and transfers open work while preserving historical authorship', async () => {
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([
      { id: 'source', userId: engineer.id, role: 'ENGINEER' },
      { id: 'target', userId: 'engineer_2', role: 'ENGINEER' },
    ] as never);
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: 'task_1', approvalStatus: 'SUBMITTED' },
    ] as never);
    vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.projectHandover.create).mockResolvedValue({
      id: 'handover_1',
      transferredTaskCount: 1,
    } as never);
    const result = await createProjectHandover(project.id, manager, handoverInput);
    expect(result.transferredTaskCount).toBe(1);
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['task_1'] }, projectId: project.id, assigneeId: engineer.id },
      data: { assigneeId: 'engineer_2' },
    });
    expect(prisma.projectHandover.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checklist: expect.objectContaining({ pendingReviewTaskIds: ['task_1'] }),
        sourceRemoved: true,
      }),
    });
    expect(prisma.projectMember.update).toHaveBeenCalledWith({
      where: { id: 'source' },
      data: { removedAt: expect.any(Date) },
    });
  });

  it('blocks direct removal while open project tasks remain', async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: 'source',
      userId: engineer.id,
      role: 'ENGINEER',
      removedAt: null,
    } as never);
    vi.mocked(prisma.task.count).mockResolvedValue(1);
    vi.mocked(prisma.bugReport.count).mockResolvedValue(0);
    vi.mocked(prisma.maintenanceRequest.count).mockResolvedValue(0);
    vi.mocked(prisma.projectDocumentation.count).mockResolvedValue(0);
    vi.mocked(prisma.release.count).mockResolvedValue(0);
    await expect(removeProjectMember(project.id, engineer.id, manager)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.projectMember.update).not.toHaveBeenCalled();
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
