import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from './errorHandler';
import { AppError } from '../lib/http';

const log = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('../lib/logger', () => ({ logger: log }));

function respond(error: unknown) {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(error, {} as Request, response as unknown as Response, vi.fn() as NextFunction);
  return response;
}

describe('safe API error handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports oversized uploads as 413 and malformed JSON as 400', () => {
    expect(
      respond({ type: 'entity.too.large', body: 'private upload' }).status,
    ).toHaveBeenCalledWith(413);
    expect(
      respond({ type: 'entity.parse.failed', body: 'private input' }).status,
    ).toHaveBeenCalledWith(400);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('does not serialize database payloads, provider errors or secrets into logs', () => {
    const error = new Error('database password=private-secret amount=9876');
    const response = respond(error);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('private-secret');
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('9876');
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCategory: 'UNEXPECTED_ERROR', httpStatus: 500 }),
      'Unhandled request failure',
    );
  });

  it('keeps safe application error messages while logging only diagnostic metadata', () => {
    const response = respond(new AppError('SERVICE_UNAVAILABLE', 503, 'Storage unavailable'));
    expect(response.json).toHaveBeenCalledWith({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Storage unavailable' },
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCategory: 'SERVICE_UNAVAILABLE', httpStatus: 503 }),
      'Request failed',
    );
  });
});
