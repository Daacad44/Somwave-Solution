// Express application assembly (SYSTEM_PROMPT §5): helmet → cors → cookieParser
// → pinoHttp → rateLimit → routes, closed by the not-found and error handlers.
// `/health` sits ahead of the rate limiter so monitors are never throttled.
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { corsOrigins } from './lib/env';
import { logger } from './lib/logger';
import { apiRateLimiter } from './middleware/rateLimit';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { publicRouter } from './routes/public.routes';
import { usersRouter, rolesRouter, permissionsRouter } from './routes/user.routes';
import { projectsRouter } from './routes/project.routes';
import { tasksRouter } from './routes/task.routes';
import { milestonesRouter } from './routes/milestone.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  // Behind Traefik — trust the first proxy hop so rate limiting sees the real
  // client IP rather than the proxy's (§13).
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);

  app.use(apiRateLimiter);

  // Feature routers mount under /api/v1.
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/permissions', permissionsRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/tasks', tasksRouter);
  app.use('/api/v1/milestones', milestonesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
