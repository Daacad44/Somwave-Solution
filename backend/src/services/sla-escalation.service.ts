import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { emitNotification } from './notification-delivery.service';

type DueRecord = {
  id: string;
  title: string;
  projectId: string;
  responseDueAt: Date | null;
  resolutionDueAt: Date | null;
  respondedAt: Date | null;
  completedAt: Date | null;
};

async function escalate(kind: 'bug' | 'maintenance', row: DueRecord, now: Date): Promise<number> {
  const responseMissed = Boolean(row.responseDueAt && row.responseDueAt < now && !row.respondedAt);
  const resolutionMissed = Boolean(
    row.resolutionDueAt && row.resolutionDueAt < now && !row.completedAt,
  );
  if (!responseMissed && !resolutionMissed) return 0;
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: {
      managerId: true,
      members: { where: { role: 'MANAGER', removedAt: null }, select: { userId: true } },
    },
  });
  const recipients = new Set(
    [project?.managerId, ...(project?.members.map((member) => member.userId) ?? [])].filter(
      (id): id is string => Boolean(id),
    ),
  );
  let sent = 0;
  for (const userId of recipients) {
    for (const stage of [
      responseMissed ? 'response' : null,
      resolutionMissed ? 'resolution' : null,
    ]) {
      if (!stage) continue;
      try {
        await emitNotification({
          userId,
          eventKey: 'sla.breach',
          dedupeKey: `sla:${kind}:${row.id}:${stage}:${stage === 'response' ? row.responseDueAt!.toISOString() : row.resolutionDueAt!.toISOString()}:${userId}`,
          title: `${kind === 'bug' ? 'Bug' : 'Maintenance'} SLA breach`,
          body: `${row.title}: ${stage} deadline was missed.`,
        });
        sent += 1;
      } catch (error) {
        logger.error({ err: error, kind, recordId: row.id }, 'SLA escalation enqueue failed');
      }
    }
  }
  return sent;
}

/** Bounded scan; stable dedupe keys prevent repeated alerts across worker runs. */
export async function scanSlaBreaches(now = new Date()): Promise<number> {
  const [bugs, maintenance] = await Promise.all([
    prisma.bugReport.findMany({
      where: {
        status: { notIn: ['RESOLVED', 'CLOSED'] },
        OR: [
          { responseDueAt: { lt: now }, respondedAt: null },
          { resolutionDueAt: { lt: now }, resolvedAt: null },
        ],
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        responseDueAt: true,
        resolutionDueAt: true,
        respondedAt: true,
        resolvedAt: true,
      },
      orderBy: { reportedAt: 'asc' },
      take: 100,
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        OR: [
          { responseDueAt: { lt: now }, respondedAt: null },
          { resolutionDueAt: { lt: now }, completedAt: null },
        ],
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        responseDueAt: true,
        resolutionDueAt: true,
        respondedAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
  ]);
  let count = 0;
  for (const bug of bugs)
    count += await escalate('bug', { ...bug, completedAt: bug.resolvedAt }, now);
  for (const request of maintenance) count += await escalate('maintenance', request, now);
  return count;
}
