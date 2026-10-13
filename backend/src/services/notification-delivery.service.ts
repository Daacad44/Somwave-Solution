import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { sendMail } from '../lib/mailer';
import { ENGINEERING_NOTIFICATION_V1 } from '../mail/templates';

export const NOTIFICATION_EVENTS = [
  'engineer.account.activated',
  'project.assignment',
  'task.assignment',
  'task.review',
  'task.deadline',
  'progress.report',
  'progress.reminder',
  'bug.assignment',
  'bug.critical',
  'github.pr',
  'github.ci',
  'release.approval',
  'deployment.complete',
  'maintenance.schedule',
  'sla.breach',
  'system.update',
  'system.health',
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export interface NotificationInput {
  eventKey: NotificationEvent;
  userId: string;
  title: string;
  body: string;
  /** Stable key for the business event and recipient; repeated calls are ignored. */
  dedupeKey: string;
  /** Transactional invitations must reach email even when optional alerts are disabled. */
  requiredEmail?: boolean;
}

export async function emitNotification(input: NotificationInput): Promise<void> {
  const [user, preference] = await Promise.all([
    prisma.user.findFirst({
      where: { id: input.userId, isActive: true, deletedAt: null },
      select: { id: true },
    }),
    prisma.notificationPreference.findUnique({
      where: { userId_eventKey: { userId: input.userId, eventKey: input.eventKey } },
    }),
  ]);
  if (!user || (preference?.inApp === false && preference.email === false && !input.requiredEmail))
    return;
  const inApp = preference?.inApp ?? true;
  const email = input.requiredEmail || (preference?.email ?? true);
  try {
    await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: { userId: input.userId, title: input.title, body: input.body },
      });
      if (inApp) {
        await tx.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: 'IN_APP',
            status: 'SENT',
            sentAt: new Date(),
            dedupeKey: `inapp:${input.dedupeKey}`,
          },
        });
      }
      if (email) {
        await tx.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: 'EMAIL',
            status: 'PENDING',
            nextAttemptAt: new Date(),
            dedupeKey: `email:${input.dedupeKey}`,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
    throw error;
  }
}

export async function listNotificationPreferences(userId: string) {
  return prisma.notificationPreference.findMany({
    where: { userId },
    select: { eventKey: true, inApp: true, email: true },
    orderBy: { eventKey: 'asc' },
  });
}

export async function setNotificationPreference(
  userId: string,
  eventKey: NotificationEvent,
  input: { inApp: boolean; email: boolean },
) {
  return prisma.notificationPreference.upsert({
    where: { userId_eventKey: { userId, eventKey } },
    create: { userId, eventKey, ...input },
    update: input,
    select: { eventKey: true, inApp: true, email: true },
  });
}

export async function listNotificationDeliveries(userId: string) {
  return prisma.notificationDelivery.findMany({
    where: { notification: { userId } },
    select: {
      id: true,
      channel: true,
      status: true,
      attempts: true,
      sentAt: true,
      error: true,
      notification: { select: { title: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/** Durable database queue: a lease lets a different process retry after a crash. */
export async function processPendingNotificationEmails(now = new Date()): Promise<number> {
  const rows = await prisma.notificationDelivery.findMany({
    where: {
      channel: 'EMAIL',
      OR: [
        { status: { in: ['PENDING', 'RETRY', 'SENDING'] }, nextAttemptAt: { lte: now } },
        ...(env.SMTP_HOST && env.SMTP_FROM ? [{ status: 'WAITING_CONFIG' }] : []),
      ],
    },
    include: {
      notification: {
        include: { user: { select: { email: true, isActive: true, deletedAt: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 25,
  });
  let processed = 0;
  for (const row of rows) {
    const claimed = await prisma.notificationDelivery.updateMany({
      where: { id: row.id, status: row.status, nextAttemptAt: row.nextAttemptAt },
      data: {
        status: 'SENDING',
        attempts: { increment: 1 },
        nextAttemptAt: new Date(now.getTime() + 120_000),
      },
    });
    if (!claimed.count) continue;
    processed += 1;
    if (!row.notification.user.isActive || row.notification.user.deletedAt) {
      await prisma.notificationDelivery.update({
        where: { id: row.id },
        data: { status: 'SKIPPED', nextAttemptAt: null, error: 'Recipient is inactive' },
      });
      continue;
    }
    try {
      const result = await sendMail({
        to: row.notification.user.email,
        template: ENGINEERING_NOTIFICATION_V1,
        vars: { subject: row.notification.title, message: row.notification.body },
      });
      if (result.sent) {
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data: { status: 'SENT', sentAt: new Date(), nextAttemptAt: null, error: null },
        });
      } else if (result.reason === 'not_configured') {
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data: { status: 'WAITING_CONFIG', nextAttemptAt: null, error: 'SMTP is not configured' },
        });
      } else {
        const attempts = row.attempts + 1;
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data: {
            status: attempts >= 5 ? 'FAILED' : 'RETRY',
            nextAttemptAt:
              attempts >= 5
                ? null
                : new Date(now.getTime() + Math.min(60_000 * 2 ** attempts, 900_000)),
            error: 'Email delivery failed',
          },
        });
      }
    } catch (error) {
      logger.error({ err: error, deliveryId: row.id }, 'Notification delivery failed');
      const attempts = row.attempts + 1;
      await prisma.notificationDelivery.update({
        where: { id: row.id },
        data: {
          status: attempts >= 5 ? 'FAILED' : 'RETRY',
          nextAttemptAt:
            attempts >= 5
              ? null
              : new Date(now.getTime() + Math.min(60_000 * 2 ** attempts, 900_000)),
          error: 'Email delivery failed',
        },
      });
    }
  }
  return processed;
}
