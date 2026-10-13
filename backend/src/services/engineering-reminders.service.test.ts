import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    task: { findMany: vi.fn() },
    projectMember: { findMany: vi.fn() },
    engineerProgressReport: { findUnique: vi.fn() },
  },
}));
vi.mock('./notification-delivery.service', () => ({ emitNotification: vi.fn() }));

import { prisma } from '../lib/prisma';
import { emitNotification } from './notification-delivery.service';
import { scanEngineeringReminders } from './engineering-reminders.service';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.task.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.projectMember.findMany).mockResolvedValue([] as never);
});

describe('engineering reminder scan', () => {
  it('uses a stable event key for the same overdue deadline across scans', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      {
        id: 'task-1',
        title: 'Ship API',
        assigneeId: 'engineer-1',
        dueDate: new Date('2026-10-12T12:00:00Z'),
      },
    ] as never);
    const first = new Date('2026-10-13T09:00:00Z');
    const second = new Date('2026-10-14T09:00:00Z');
    await scanEngineeringReminders(first);
    await scanEngineeringReminders(second);
    expect(emitNotification).toHaveBeenCalledTimes(2);
    const keys = vi.mocked(emitNotification).mock.calls.map(([input]) => input.dedupeKey);
    expect(keys[0]).toBe(keys[1]);
  });

  it('only reminds missing weekly reports for the previous Monday', async () => {
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([
      {
        userId: 'engineer-1',
        projectId: 'project-1',
        project: { name: 'Alpha' },
      },
    ] as never);
    vi.mocked(prisma.engineerProgressReport.findUnique).mockResolvedValue(null as never);
    await scanEngineeringReminders(new Date('2026-10-12T10:30:00Z'));
    expect(prisma.engineerProgressReport.findUnique).toHaveBeenCalledWith({
      where: {
        projectId_authorId_period_periodStart: {
          projectId: 'project-1',
          authorId: 'engineer-1',
          period: 'WEEKLY',
          periodStart: new Date('2026-10-05T00:00:00.000Z'),
        },
      },
      select: { id: true },
    });
  });
});
