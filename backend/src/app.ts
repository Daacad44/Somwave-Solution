// Express application assembly (SYSTEM_PROMPT §5): helmet → cors → cookieParser
// → pinoHttp → rateLimit → routes, closed by the not-found and error handlers.
// `/health` sits ahead of the rate limiter so monitors are never throttled.
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { corsOrigins } from './lib/env';
import { buildCorsOptions } from './lib/cors';
import { logger } from './lib/logger';
import { apiRateLimiter } from './middleware/rateLimit';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { publicRouter } from './routes/public.routes';
import { usersRouter, rolesRouter, permissionsRouter } from './routes/user.routes';
import { projectsRouter } from './routes/project.routes';
import { tasksRouter } from './routes/task.routes';
import { milestonesRouter } from './routes/milestone.routes';
import { cmsRouter } from './routes/cms.routes';
import {
  leadsRouter,
  applicationsRouter,
  clientsRouter,
  timesheetsRouter,
  invoicesRouter,
  ticketsRouter,
  portalRouter,
  paymentsRouter,
} from './routes/platform.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { paymentWebhooksRouter } from './routes/payment.webhook.routes';
import {
  employeesRouter,
  attendanceRouter,
  leaveRouter,
  documentsRouter,
  mediaRouter,
  auditRouter,
  notificationsRouter,
} from './routes/ops-extra.routes';

export function createApp(): Express {
  const app = express();

  // Behind Traefik — trust the first proxy hop so rate limiting sees the real
  // client IP rather than the proxy's (§13).
  app.set('trust proxy', 1);

  // API is consumed by the dashboard on another origin; helmet's default
  // Cross-Origin-Resource-Policy: same-origin would block that read.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(buildCorsOptions(corsOrigins)));
  app.use(cookieParser());
  app.use(
    '/api/v1/payments/webhooks',
    express.raw({ type: 'application/json', limit: '256kb' }),
    paymentWebhooksRouter,
  );
  app.use('/api/v1/media', express.json({ limit: '35mb' }));
  app.use('/api/v1/documents', express.json({ limit: '35mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);

  app.use(apiRateLimiter);

  // Feature routers mount under /api/v1.
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/permissions', permissionsRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/tasks', tasksRouter);
  app.use('/api/v1/milestones', milestonesRouter);
  app.use('/api/v1/cms', cmsRouter);
  app.use('/api/v1/leads', leadsRouter);
  app.use('/api/v1/job-applications', applicationsRouter);
  app.use('/api/v1/clients', clientsRouter);
  app.use('/api/v1/timesheets', timesheetsRouter);
  app.use('/api/v1/invoices', invoicesRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/support-tickets', ticketsRouter);
  app.use('/api/v1/portal', portalRouter);
  app.use('/api/v1/employees', employeesRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/leave-requests', leaveRouter);
  app.use('/api/v1/documents', documentsRouter);
  app.use('/api/v1/media', mediaRouter);
  app.use('/api/v1/audit-logs', auditRouter);
  app.use('/api/v1/notifications', notificationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
