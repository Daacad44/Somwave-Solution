// Rate limiting (SYSTEM_PROMPT §13). The global limiter guards every route; login
// is additionally limited by IP AND by account — one alone is not enough. 429s
// return the standard RATE_LIMITED envelope (§10).
import rateLimit, { type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { sendError } from '../lib/http';

const rateLimitedHandler: Options['handler'] = (_req, res) => {
  sendError(res, 'RATE_LIMITED', 429, 'Too many requests, please try again later');
};

const shared = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitedHandler,
} as const;

export const apiRateLimiter = rateLimit({ windowMs: 60_000, limit: 100, ...shared });

// Public website endpoints (unauthenticated) get their own, tighter budget.
export const publicRateLimiter = rateLimit({ windowMs: 60_000, limit: 60, ...shared });

// By client IP.
export const loginIpRateLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, ...shared });

// By account (email in the request body); skipped when no email is present.
export const loginAccountRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  ...shared,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `acct:${email}`;
  },
  skip: (req: Request) => typeof req.body?.email !== 'string' || req.body.email.length === 0,
});
