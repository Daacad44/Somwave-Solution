// Central pino logger (SYSTEM_PROMPT §4). Secrets are redacted so a connection
// string, cookie, or token never reaches the logs (§13).
import { pino } from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.secret',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
    ],
    remove: true,
  },
});
