import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    notificationPreference: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    notificationDelivery: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  },
}));
vi.mock('../lib/mailer', () => ({ sendMail: vi.fn() }));

import { prisma } from '../lib/prisma';
import { sendMail } from '../lib/mailer';
import {
  emitNotification,
  processPendingNotificationEmails,
} from './notification-delivery.service';

beforeEach(() => vi.clearAllMocks());

describe('engineering notification delivery', () => {
  it('creates an in-app item and an email queue entry with stable dedupe keys', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user_1' } as never);
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notification_1' } as never);
    await emitNotification({
      eventKey: 'project.assignment',
      userId: 'user_1',
      title: 'Assigned',
      body: 'Project assigned',
      dedupeKey: 'assignment:1',
    });
    expect(prisma.notificationDelivery.create).toHaveBeenCalledTimes(2);
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: 'IN_APP', dedupeKey: 'inapp:assignment:1' }),
    });
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: 'EMAIL', dedupeKey: 'email:assignment:1' }),
    });
  });

  it('respects a preference that disables both channels', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user_1' } as never);
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      inApp: false,
      email: false,
    } as never);
    await emitNotification({
      eventKey: 'task.review',
      userId: 'user_1',
      title: 'Review',
      body: 'Approved',
      dedupeKey: 'review:1',
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('still queues the required invitation email when optional alerts are disabled', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user_1' } as never);
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      inApp: false,
      email: false,
    } as never);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notification_1' } as never);
    await emitNotification({
      eventKey: 'project.assignment',
      userId: 'user_1',
      title: 'Invitation',
      body: 'Accept your project invitation',
      dedupeKey: 'invite:1',
      requiredEmail: true,
    });
    expect(prisma.notificationDelivery.create).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: 'EMAIL', dedupeKey: 'email:invite:1' }),
    });
  });

  it('marks a claimed email delivered after the mailer succeeds', async () => {
    vi.mocked(prisma.notificationDelivery.findMany).mockResolvedValue([
      {
        id: 'delivery_1',
        status: 'PENDING',
        nextAttemptAt: new Date(),
        attempts: 0,
        notification: {
          title: 'Review',
          body: 'Approved',
          user: { email: 'user@example.test', isActive: true, deletedAt: null },
        },
      },
    ] as never);
    vi.mocked(prisma.notificationDelivery.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(sendMail).mockResolvedValue({ sent: true });
    expect(await processPendingNotificationEmails()).toBe(1);
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery_1' },
      data: expect.objectContaining({ status: 'SENT', nextAttemptAt: null }),
    });
  });
});
