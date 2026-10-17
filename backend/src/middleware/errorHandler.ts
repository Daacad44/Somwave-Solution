// Central error handling. Provider/database payloads can contain private data;
// diagnostics retain correlation and categories without serializing the error.
import type { NextFunction, Request, Response } from 'express';
import { AppError, sendError } from '../lib/http';
import { logger } from '../lib/logger';
import { correlationId } from '../lib/requestContext';

export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, 'NOT_FOUND', 404, 'Resource not found');
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction, // Express identifies error middleware by arity (4 args).
): void {
  const type = err && typeof err === 'object' && 'type' in err ? err.type : undefined;
  if (type === 'entity.too.large') {
    sendError(res, 'VALIDATION_ERROR', 413, 'Upload or request exceeds the size limit');
    return;
  }
  if (type === 'entity.parse.failed') {
    sendError(res, 'VALIDATION_ERROR', 400, 'Request must contain valid JSON');
    return;
  }
  const diagnostic = {
    requestId: correlationId(),
    errorCategory: err instanceof AppError ? err.code : 'UNEXPECTED_ERROR',
    httpStatus: err instanceof AppError ? err.status : 500,
  };
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error(diagnostic, 'Request failed');
    sendError(res, err.code, err.status, err.message, err.details);
    return;
  }
  logger.error(diagnostic, 'Unhandled request failure');
  sendError(res, 'INTERNAL_ERROR', 500, 'Something went wrong');
}
