import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

interface RequestContext {
  correlationId: string;
  ip: string | null;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function correlationId(): string | null {
  return requestContext.getStore()?.correlationId ?? null;
}

/** Client IP as resolved by Express (`trust proxy` set for Traefik). */
export function requestIp(): string | null {
  return requestContext.getStore()?.ip ?? null;
}

export function withRequestContext(req: Request, res: Response, next: NextFunction): void {
  // Generate an ID on the server so clients cannot choose an audit correlation
  // key that impersonates another request.
  const id = randomUUID();
  res.setHeader('X-Request-ID', id);
  requestContext.run({ correlationId: id, ip: req.ip ?? null }, next);
}
