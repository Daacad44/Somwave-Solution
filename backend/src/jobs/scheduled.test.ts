import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/notification-delivery.service', () => ({
  processPendingNotificationEmails: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/sla-escalation.service', () => ({ scanSlaBreaches: vi.fn() }));
vi.mock('../services/system-health.service', () => ({ scanSystemHealth: vi.fn() }));
vi.mock('../services/engineering-reminders.service', () => ({
  scanEngineeringReminders: vi.fn(),
}));
vi.mock('../services/domain-event.service', () => ({
  relayPendingEvents: vi.fn().mockResolvedValue({ published: 0, failed: 0 }),
}));

import { relayPendingEvents } from '../services/domain-event.service';
import { processPendingNotificationEmails } from '../services/notification-delivery.service';
import { SCHEDULED_JOBS, findScheduledJob } from './scheduled';
import { domainEventJobOptions } from './queues';

describe('scheduled jobs', () => {
  it('keeps the pre-I8 cadences and adds the outbox relay', () => {
    expect(Object.fromEntries(SCHEDULED_JOBS.map((job) => [job.name, job.everyMs]))).toEqual({
      'outbox.relay': 5_000,
      'notifications.deliver': 30_000,
      'system-health.scan': 300_000,
      'sla.scan': 900_000,
      'engineering.reminders': 3_600_000,
    });
  });

  it('dispatches by job name', async () => {
    const publishEvent = vi.fn();
    await findScheduledJob('outbox.relay')?.run({ publishEvent });
    expect(relayPendingEvents).toHaveBeenCalledWith(publishEvent);
    await findScheduledJob('notifications.deliver')?.run({ publishEvent });
    expect(processPendingNotificationEmails).toHaveBeenCalled();
    expect(findScheduledJob('unknown')).toBeUndefined();
  });

  it('uses the event id as the BullMQ job id', () => {
    expect(domainEventJobOptions('evt_1')).toMatchObject({ jobId: 'evt_1', attempts: 8 });
  });
});
