import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    task: { findFirst: vi.fn() },
    engineerTaskTimer: { create: vi.fn(), findFirst: vi.fn() },
    taskTimeEntry: { findFirst: vi.fn(), aggregate: vi.fn() },
    taskTimeEntryRevision: { findMany: vi.fn() },
    engineerProgressReport: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock('../lib/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('./notification-delivery.service', () => ({ emitNotification: vi.fn() }));

import { prisma } from '../lib/prisma';
import {
  correctTaskTimeEntry,
  createProgressReport,
  startTaskTimer,
  stopActiveTimer,
} from './engineering-worklog.service';

const engineer = { id: 'user-1', roles: ['ENGINEER'] } as Express.AuthUserContext;
const manager = { id: 'manager-1', roles: ['ADMIN'] } as Express.AuthUserContext;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findFirst).mockResolvedValue({
    id: 'project-1',
    name: 'Alpha',
    managerId: 'manager-1',
  } as never);
  vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
    role: 'ENGINEER',
    removedAt: null,
  } as never);
  vi.mocked(prisma.task.findFirst).mockResolvedValue({
    id: 'task-1',
    projectId: 'project-1',
    assigneeId: 'user-1',
    approvalStatus: 'APPROVED',
  } as never);
});

describe('engineering timer', () => {
  it('blocks timers for tasks assigned to another engineer', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
      assigneeId: 'user-2',
      approvalStatus: 'APPROVED',
    } as never);
    await expect(startTaskTimer('task-1', engineer)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.engineerTaskTimer.create).not.toHaveBeenCalled();
  });

  it('prevents recording a timer older than 24 hours', async () => {
    vi.mocked(prisma.engineerTaskTimer.findFirst).mockResolvedValue({
      id: 'timer-1',
      taskId: 'task-1',
      startedAt: new Date(Date.now() - 25 * 3600_000),
      task: {
        projectId: 'project-1',
        assigneeId: 'user-1',
        approvalStatus: 'APPROVED',
        deletedAt: null,
      },
    } as never);
    await expect(stopActiveTimer(engineer, {})).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('time corrections', () => {
  it('rejects a different engineer and does not write a revision', async () => {
    vi.mocked(prisma.taskTimeEntry.findFirst).mockResolvedValue({
      id: 'entry-1',
      userId: 'user-2',
    } as never);
    await expect(
      correctTaskTimeEntry('task-1', 'entry-1', engineer, {
        minutes: 60,
        date: '2026-10-13',
        reason: 'Forgot to stop timer',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects impossible work dates before mutation', async () => {
    vi.mocked(prisma.taskTimeEntry.findFirst).mockResolvedValue({
      id: 'entry-1',
      userId: 'user-2',
    } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null as never);
    await expect(
      correctTaskTimeEntry('task-1', 'entry-1', manager, {
        minutes: 60,
        date: '2026-02-30',
        reason: 'Correcting an error',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('progress reports', () => {
  it('requires a Monday for a weekly report', async () => {
    await expect(
      createProgressReport('project-1', engineer, {
        period: 'WEEKLY',
        periodStart: '2026-10-13',
        completedWork: 'Implemented task',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.engineerProgressReport.create).not.toHaveBeenCalled();
  });

  it('keeps reported hours separate from tracked time entries', async () => {
    vi.mocked(prisma.taskTimeEntry.aggregate).mockResolvedValue({
      _sum: { minutes: 120 },
    } as never);
    vi.mocked(prisma.engineerProgressReport.create).mockResolvedValue({ id: 'report-1' } as never);
    await createProgressReport('project-1', engineer, {
      period: 'DAILY',
      periodStart: '2026-10-12',
      completedWork: 'Implemented task',
      reportedHoursMinutes: 480,
    });
    expect(prisma.engineerProgressReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ hoursWorkedMinutes: 120, reportedHoursMinutes: 480 }),
    });
  });
});
