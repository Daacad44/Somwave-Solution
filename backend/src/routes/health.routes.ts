// Liveness/readiness endpoint (SYSTEM_PROMPT §14). Coolify must not report a
// container healthy when it cannot reach its dependencies, so this actually
// pings them. Postgres is added here when Prisma is wired in F0.3.
import { Router } from 'express';
import { pingRedis } from '../lib/redis';
import { sendData, sendError } from '../lib/http';

export const healthRouter: Router = Router();

healthRouter.get('/health', async (_req, res) => {
  const redisOk = await pingRedis();
  const checks = { redis: redisOk };

  if (!redisOk) {
    sendError(res, 'INTERNAL_ERROR', 503, 'Service unhealthy', checks);
    return;
  }
  sendData(res, { status: 'ok', checks });
});
