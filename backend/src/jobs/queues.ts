// Queue names and job options shared by the worker and the outbox relay (I8.0).
import type { JobsOptions } from 'bullmq';

export const SCHEDULED_QUEUE = 'somwave-scheduled';
export const DOMAIN_EVENTS_QUEUE = 'somwave-domain-events';

/** Handler retries for one domain event before it is parked as FAILED. */
export const DOMAIN_EVENT_ATTEMPTS = 8;

export function domainEventJobOptions(eventId: string): JobsOptions {
  return {
    // The event id is the job id, so republishing an event cannot enqueue it twice.
    jobId: eventId,
    attempts: DOMAIN_EVENT_ATTEMPTS,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 1_000 },
    removeOnFail: { count: 5_000 },
  };
}
