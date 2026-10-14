import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

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
vi.mock('../lib/mailer', () => ({ sendMail: vi.fn(), emailReadiness: vi.fn() }));

import { prisma } from '../lib/prisma';
import { emailReadiness, sendMail } from '../lib/mailer';
import {
  emitNotification,
  processPendingNotificationEmails,
} from './notification-delivery.service';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(emailReadiness).mockReturnValue({ provider: 'resend', configured: true, missing: [] });
});

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

  it('rearms a failed required invitation without creating a duplicate delivery', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user_1' } as never);
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notification_2' } as never);
    vi.mocked(prisma.notificationDelivery.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.0.0',
      }),
    );
    await emitNotification({
      eventKey: 'project.assignment',
      userId: 'user_1',
      title: 'Invitation',
      body: 'Review invitation',
      dedupeKey: 'invite:1',
      requiredEmail: true,
    });
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: { dedupeKey: 'email:invite:1', channel: 'EMAIL', status: 'FAILED' },
      data: expect.objectContaining({ status: 'RETRY', attempts: 0, error: null }),
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
    vi.mocked(sendMail).mockResolvedValue({ sent: true, providerMessageId: 'resend-message-1' });
    expect(await processPendingNotificationEmails()).toBe(1);
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery_1' },
      data: expect.objectContaining({
        status: 'ACCEPTED',
        providerMessageId: 'resend-message-1',
        nextAttemptAt: null,
      }),
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^notification:[a-f0-9]{64}$/),
      }),
    );
  });

  it('holds delivery until Resend is configured', async () => {
    vi.mocked(emailReadiness).mockReturnValue({
      provider: 'resend',
      configured: false,
      missing: ['RESEND_API_KEY'],
    });
    vi.mocked(prisma.notificationDelivery.findMany).mockResolvedValue([
      {
        id: 'delivery_1',
        status: 'PENDING',
        nextAttemptAt: new Date(),
        attempts: 0,
        notification: {
          title: 'Invitation',
          body: 'Review invitation',
          user: { email: 'user@example.test', isActive: true, deletedAt: null },
        },
      },
    ] as never);
    vi.mocked(prisma.notificationDelivery.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(sendMail).mockResolvedValue({ sent: false, reason: 'not_configured' });
    await processPendingNotificationEmails();
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery_1' },
      data: expect.objectContaining({
        status: 'WAITING_CONFIG',
        error: 'Resend is not configured',
      }),
    });
  });

  it('retries provider rate limits with backoff and fails permanent credential errors', async () => {
    const now = new Date('2026-10-14T10:00:00.000Z');
    vi.mocked(prisma.notificationDelivery.findMany).mockResolvedValue([
      {
        id: 'delivery_1',
        status: 'PENDING',
        nextAttemptAt: now,
        attempts: 0,
        notification: {
          title: 'Invitation',
          body: 'Review invitation',
          user: { email: 'user@example.test', isActive: true, deletedAt: null },
        },
      },
    ] as never);
    vi.mocked(prisma.notificationDelivery.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(sendMail).mockResolvedValueOnce({ sent: false, reason: 'rate_limited' });
    await processPendingNotificationEmails(now);
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery_1' },
      data: expect.objectContaining({ status: 'RETRY', nextAttemptAt: expect.any(Date) }),
    });
    vi.mocked(sendMail).mockResolvedValueOnce({ sent: false, reason: 'invalid_credentials' });
    await processPendingNotificationEmails(now);
    expect(prisma.notificationDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'delivery_1' },
      data: expect.objectContaining({ status: 'FAILED', nextAttemptAt: null }),
    });
  });

  it('does not send when another worker already claimed the delivery', async () => {
    vi.mocked(prisma.notificationDelivery.findMany).mockResolvedValue([
      {
        id: 'delivery_1',
        status: 'PENDING',
        nextAttemptAt: new Date(),
        attempts: 0,
        notification: {
          title: 'Invitation',
          body: 'Review invitation',
          user: { email: 'user@example.test', isActive: true, deletedAt: null },
        },
      },
    ] as never);
    vi.mocked(prisma.notificationDelivery.updateMany).mockResolvedValue({ count: 0 } as never);
    expect(await processPendingNotificationEmails()).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
