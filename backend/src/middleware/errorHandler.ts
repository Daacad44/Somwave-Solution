// Central error handling (SYSTEM_PROMPT §5, §10). Full detail is logged
// server-side; the client receives a safe, enveloped message.
import type { NextFunction, Request, Response } from 'express';
import { AppError, sendError } from '../lib/http';
import { logger } from '../lib/logger';

export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, 'NOT_FOUND', 404, 'Resource not found');
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction, // Express identifies error middleware by arity (4 args).
): void {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err }, err.message);
    sendError(res, err.code, err.status, err.message, err.details);
    return;
  }
  logger.error({ err }, 'Unhandled error');
  sendError(res, 'INTERNAL_ERROR', 500, 'Something went wrong');
}
