import type { AdminAuditLog, AdminNotification } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

export async function listAuditLogs(): Promise<AdminAuditLog[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    actorId: row.actorId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listNotifications(userId: string): Promise<AdminNotification[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(id: string, userId: string): Promise<AdminNotification> {
  const existing = await prisma.notification.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Ogeysiiska lama helin');
  const row = await prisma.notification.update({
    where: { id },
    data: { readAt: existing.readAt ?? new Date() },
  });
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
