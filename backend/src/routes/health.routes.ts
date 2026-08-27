// Liveness/readiness endpoint (SYSTEM_PROMPT §14). Coolify must not report a
// container healthy when it cannot reach its dependencies, so this actually
// pings Postgres and Redis.
import { Router } from 'express';
import { pingRedis } from '../lib/redis';
import { pingPostgres } from '../lib/prisma';
import { sendData, sendError } from '../lib/http';

export const healthRouter: Router = Router();

healthRouter.get('/health', async (_req, res) => {
  const [redisOk, postgresOk] = await Promise.all([pingRedis(), pingPostgres()]);
  const checks = { redis: redisOk, postgres: postgresOk };

  if (!redisOk || !postgresOk) {
    sendError(res, 'INTERNAL_ERROR', 503, 'Service unhealthy', checks);
    return;
  }
  sendData(res, { status: 'ok', checks });
});
