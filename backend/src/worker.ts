import './lib/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startBackgroundJobs } from './background-jobs';

const stop = startBackgroundJobs(false);
logger.info('Somwave background worker started');

function shutdown(signal: string): void {
  logger.info(`${signal} received — stopping background worker`);
  stop();
  void prisma.$disconnect().finally(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
