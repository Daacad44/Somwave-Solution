import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { emitNotification } from './notification-delivery.service';

/** Bounded scans are safe across workers because notification delivery keys are unique. */
export async function scanEngineeringReminders(now = new Date()): Promise<number> {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      project: { deletedAt: null },
      status: { notIn: ['DONE', 'CANCELLED'] },
      assigneeId: { not: null },
      dueDate: { gt: weekAgo, lte: tomorrow },
    },
    select: { id: true, title: true, assigneeId: true, dueDate: true },
    orderBy: { dueDate: 'asc' },
    take: 200,
  });
  let queued = 0;
  for (const task of tasks) {
    if (!task.assigneeId || !task.dueDate) continue;
    const overdue = task.dueDate < now;
    const dueDay = task.dueDate.toISOString().slice(0, 10);
    try {
      await emitNotification({
        userId: task.assigneeId,
        eventKey: 'task.deadline',
        dedupeKey: `task-deadline:${task.id}:${overdue ? 'overdue' : 'upcoming'}:${dueDay}:${task.assigneeId}`,
        title: overdue ? 'Task overdue' : 'Task deadline approaching',
        body: `${task.title} ${overdue ? 'was due on' : 'is due on'} ${dueDay}.`,
      });
      queued += 1;
    } catch (error) {
      logger.error({ err: error, taskId: task.id }, 'Task reminder failed');
    }
  }

  const day = now.getUTCDay();
  const dailyWindow = day >= 1 && day <= 5 && now.getUTCHours() >= 17;
  const weeklyWindow = day === 1 && now.getUTCHours() >= 10;
  if (!dailyWindow && !weeklyWindow) return queued;

  const members = await prisma.projectMember.findMany({
    where: {
      removedAt: null,
      role: { in: ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER', 'CONTRIBUTOR'] },
      project: { deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    },
    select: { userId: true, projectId: true, project: { select: { name: true } } },
    take: 200,
  });
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const previousMonday = new Date(today);
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
  for (const member of members) {
    for (const period of [dailyWindow ? 'DAILY' : null, weeklyWindow ? 'WEEKLY' : null] as const) {
      if (!period) continue;
      const periodStart = period === 'DAILY' ? today : previousMonday;
      const existing = await prisma.engineerProgressReport.findUnique({
        where: {
          projectId_authorId_period_periodStart: {
            projectId: member.projectId,
            authorId: member.userId,
            period,
            periodStart,
          },
        },
        select: { id: true },
      });
      if (existing) continue;
      try {
        await emitNotification({
          userId: member.userId,
          eventKey: 'progress.reminder',
          dedupeKey: `progress-reminder:${period}:${member.projectId}:${member.userId}:${periodStart.toISOString().slice(0, 10)}`,
          title: `${period === 'DAILY' ? 'Daily' : 'Weekly'} progress report reminder`,
          body: `Please submit your ${period.toLowerCase()} progress report for ${member.project.name}.`,
        });
        queued += 1;
      } catch (error) {
        logger.error({ err: error, projectId: member.projectId }, 'Progress reminder failed');
      }
    }
  }
  return queued;
}
