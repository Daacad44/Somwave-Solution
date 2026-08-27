// Process entry point. Importing ./lib/env validates the environment and exits
// on failure before anything else runs (§13). Handles graceful shutdown.
import { createApp } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { redis } from './lib/redis';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Somwave API listening on :${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down`);
  server.close(() => {
    void redis.quit().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
