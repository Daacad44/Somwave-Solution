// Process entry point. Importing ./lib/env validates the environment and exits
// on failure before anything else runs (§13). Handles graceful shutdown.
import { createApp } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { redis } from './lib/redis';
import { prisma } from './lib/prisma';
import { startBackgroundJobs } from './background-jobs';

const app = createApp();

// Bind 0.0.0.0 so Traefik/Coolify can reach the process (not loopback-only).
const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`Somwave API listening on 0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
});

const stopBackgroundJobs =
  env.BACKGROUND_WORKERS_ENABLED === 'true' ? startBackgroundJobs() : () => undefined;

function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down`);
  stopBackgroundJobs();
  server.close(() => {
    void Promise.allSettled([redis.quit(), prisma.$disconnect()]).finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
