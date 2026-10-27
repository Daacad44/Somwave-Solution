// Background worker process (I8.0). The only process that runs scheduled work:
// the API runs no timers. Deploy exactly one per environment (see Dockerfile).
import './lib/env';
import { Queue, Worker, type Job } from 'bullmq';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { createQueueConnection } from './jobs/connection';
import {
  DOMAIN_EVENT_ATTEMPTS,
  DOMAIN_EVENTS_QUEUE,
  SCHEDULED_QUEUE,
  domainEventJobOptions,
} from './jobs/queues';
import { SCHEDULED_JOBS, findScheduledJob } from './jobs/scheduled';
import { processDomainEvent, recordEventFailure } from './services/domain-event.service';

const connection = createQueueConnection();
const scheduledQueue = new Queue(SCHEDULED_QUEUE, { connection });
const eventsQueue = new Queue(DOMAIN_EVENTS_QUEUE, { connection });

async function registerSchedules(): Promise<void> {
  const wanted = new Set(SCHEDULED_JOBS.map((job) => job.name));
  for (const job of SCHEDULED_JOBS) {
    await scheduledQueue.upsertJobScheduler(
      job.name,
      { every: job.everyMs },
      { name: job.name, opts: { removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } } },
    );
  }
  // Drop schedulers for jobs that no longer exist in code.
  for (const scheduler of await scheduledQueue.getJobSchedulers()) {
    if (!wanted.has(scheduler.key)) await scheduledQueue.removeJobScheduler(scheduler.key);
  }
}

const scheduledWorker = new Worker(
  SCHEDULED_QUEUE,
  async (job: Job) => {
    const definition = findScheduledJob(job.name);
    if (!definition) throw new Error(`Unknown scheduled job ${job.name}`);
    return definition.run({
      publishEvent: async (event) => {
        await eventsQueue.add(event.type, { eventId: event.id }, domainEventJobOptions(event.id));
      },
    });
  },
  // Concurrency 1: a slow scan never overlaps itself within this worker.
  { connection, concurrency: 1 },
);

const eventsWorker = new Worker(
  DOMAIN_EVENTS_QUEUE,
  async (job: Job<{ eventId: string }>) => processDomainEvent(job.data.eventId),
  { connection, concurrency: 5 },
);

scheduledWorker.on('failed', (job, err) => {
  logger.error({ err, job: job?.name }, 'Scheduled job failed');
});
eventsWorker.on('failed', (job, err) => {
  if (!job) return;
  const final = job.attemptsMade >= (job.opts.attempts ?? DOMAIN_EVENT_ATTEMPTS);
  logger.error({ err, eventId: job.data.eventId, final }, 'Domain event handler failed');
  void recordEventFailure(job.data.eventId, err, final).catch((error: unknown) =>
    logger.error({ err: error }, 'Could not record domain event failure'),
  );
});

registerSchedules()
  .then(() => logger.info('Somwave background worker started'))
  .catch((err: unknown) => {
    logger.fatal({ err }, 'Could not register scheduled jobs');
    process.exit(1);
  });

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — stopping background worker`);
  await Promise.allSettled([scheduledWorker.close(), eventsWorker.close()]);
  await Promise.allSettled([scheduledQueue.close(), eventsQueue.close()]);
  await Promise.allSettled([connection.quit(), prisma.$disconnect()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
