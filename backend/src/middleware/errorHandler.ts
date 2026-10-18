// Central error handling. Provider/database payloads can contain private data,
// so the error message is never logged. Diagnostics keep identifiers only: error
// name, Prisma code, model/column/constraint names and stack frames — enough to
// root-cause a 500 from the logs without leaking values.
import type { NextFunction, Request, Response } from 'express';
import { AppError, sendError } from '../lib/http';
import { logger } from '../lib/logger';
import { correlationId } from '../lib/requestContext';

export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, 'NOT_FOUND', 404, 'Resource not found');
}

interface PrismaLikeError {
  name?: unknown;
  code?: unknown;
  meta?: unknown;
  stack?: unknown;
}

const PRISMA_CODE = /^P\d{4}$/;
const IDENTIFIER = /^[A-Za-z0-9_.]{1,80}$/;

/** Identifier-only details for logs. Values (messages, field contents) are dropped. */
export function errorDiagnostics(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== 'object') return {};
  const e = err as PrismaLikeError;
  const details: Record<string, unknown> = {};
  if (typeof e.name === 'string' && IDENTIFIER.test(e.name)) details.errorName = e.name;
  if (typeof e.code === 'string' && PRISMA_CODE.test(e.code)) details.prismaCode = e.code;
  if (e.meta && typeof e.meta === 'object') {
    for (const key of ['modelName', 'table', 'column', 'target', 'field_name'] as const) {
      const value = (e.meta as Record<string, unknown>)[key];
      const names = Array.isArray(value) ? value : [value];
      const safe = names.filter(
        (name): name is string => typeof name === 'string' && IDENTIFIER.test(name),
      );
      if (safe.length) details[key] = safe.join(',');
    }
  }
  if (typeof e.stack === 'string') {
    // Frames only: the first line repeats the message, which may hold data.
    details.stack = e.stack
      .split('\n')
      .filter((line) => line.trimStart().startsWith('at '))
      .slice(0, 12)
      .map((line) => line.trim());
  }
  return details;
}

/** Known Prisma request errors that are client conflicts, not server faults. */
function prismaClientError(err: unknown): AppError | null {
  const code = err && typeof err === 'object' ? (err as PrismaLikeError).code : undefined;
  if (code === 'P2002') return new AppError('CONFLICT', 409, 'This record already exists');
  if (code === 'P2025') return new AppError('NOT_FOUND', 404, 'Resource not found');
  return null;
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
  const mapped = prismaClientError(err);
  if (mapped) {
    logger.warn(
      { requestId: correlationId(), httpStatus: mapped.status, ...errorDiagnostics(err) },
      'Database constraint rejected request',
    );
    sendError(res, mapped.code, mapped.status, mapped.message);
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
  logger.error({ ...diagnostic, ...errorDiagnostics(err) }, 'Unhandled request failure');
  sendError(res, 'INTERNAL_ERROR', 500, 'Something went wrong');
}
