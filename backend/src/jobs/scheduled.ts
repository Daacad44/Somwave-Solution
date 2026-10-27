// Repeatable jobs run by the worker process (I8.0). Each runs on BullMQ's job
// scheduler with a deterministic id, so redeploys replace rather than duplicate.
import { processPendingNotificationEmails } from '../services/notification-delivery.service';
import { scanSlaBreaches } from '../services/sla-escalation.service';
import { scanSystemHealth } from '../services/system-health.service';
import { scanEngineeringReminders } from '../services/engineering-reminders.service';
import { relayPendingEvents, type PublishableEvent } from '../services/domain-event.service';

export interface ScheduledJobContext {
  publishEvent(event: PublishableEvent): Promise<void>;
}

export interface ScheduledJob {
  name: string;
  everyMs: number;
  run(context: ScheduledJobContext): Promise<unknown>;
}

export const SCHEDULED_JOBS: readonly ScheduledJob[] = [
  { name: 'outbox.relay', everyMs: 5_000, run: (ctx) => relayPendingEvents(ctx.publishEvent) },
  { name: 'notifications.deliver', everyMs: 30_000, run: () => processPendingNotificationEmails() },
  { name: 'system-health.scan', everyMs: 5 * 60_000, run: () => scanSystemHealth() },
  { name: 'sla.scan', everyMs: 15 * 60_000, run: () => scanSlaBreaches() },
  { name: 'engineering.reminders', everyMs: 60 * 60_000, run: () => scanEngineeringReminders() },
];

export function findScheduledJob(name: string): ScheduledJob | undefined {
  return SCHEDULED_JOBS.find((job) => job.name === name);
}
