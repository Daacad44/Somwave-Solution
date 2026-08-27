// Express application assembly (SYSTEM_PROMPT §5): helmet → cors → cookieParser
// → pinoHttp → rateLimit → routes, closed by the not-found and error handlers.
// `/health` sits ahead of the rate limiter so monitors are never throttled.
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import { corsOrigins } from './lib/env';
import { logger } from './lib/logger';
import { healthRouter } from './routes/health.routes';
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

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  // Feature routers mount under /api/v1 from F0.3 onward.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
