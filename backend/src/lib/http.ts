// The standard API response envelope (SYSTEM_PROMPT §10). Every endpoint returns
// through these helpers — no ad-hoc JSON shapes anywhere else.
import type { Response } from 'express';
import { type ErrorCode } from '@somwave/shared';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

// Thrown by services/controllers; caught by the central error handler and
// serialised into the error envelope.
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

export function sendData<T>(res: Response, data: T, status = 200, meta?: PaginationMeta): void {
  res.status(status).json(meta ? { data, meta } : { data });
}

export function sendError(
  res: Response,
  code: ErrorCode,
  status: number,
  message: string,
  details?: unknown,
): void {
  res.status(status).json({
    error: details === undefined ? { code, message } : { code, message, details },
  });
}
