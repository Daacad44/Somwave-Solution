// Process entry point. Importing ./lib/env validates the environment and exits
// on failure before anything else runs (§13). Handles graceful shutdown.
import { createApp } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { redis } from './lib/redis';
import { prisma } from './lib/prisma';
import { processPendingNotificationEmails } from './services/notification-delivery.service';
import { scanSlaBreaches } from './services/sla-escalation.service';

const app = createApp();

// Bind 0.0.0.0 so Traefik/Coolify can reach the process (not loopback-only).
const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`Somwave API listening on 0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
});

let notificationRunActive = false;
async function runNotificationQueue(): Promise<void> {
  if (notificationRunActive) return;
  notificationRunActive = true;
  try {
    await processPendingNotificationEmails();
  } catch (error) {
    logger.error({ err: error }, 'Notification queue iteration failed');
  } finally {
    notificationRunActive = false;
  }
}
const notificationTimer = setInterval(() => void runNotificationQueue(), 30_000);
notificationTimer.unref();
void runNotificationQueue();

let slaRunActive = false;
async function runSlaScan(): Promise<void> {
  if (slaRunActive) return;
  slaRunActive = true;
  try {
    await scanSlaBreaches();
  } catch (error) {
    logger.error({ err: error }, 'SLA scan failed');
  } finally {
    slaRunActive = false;
  }
}
const slaTimer = setInterval(() => void runSlaScan(), 15 * 60_000);
slaTimer.unref();
void runSlaScan();

function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down`);
  clearInterval(notificationTimer);
  clearInterval(slaTimer);
  server.close(() => {
    void Promise.allSettled([redis.quit(), prisma.$disconnect()]).finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
