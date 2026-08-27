import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { validate } from './validate';
import { AppError } from '../lib/http';

const schema = z.object({ name: z.string().min(1) });

describe('validate', () => {
  it('passes a valid body and strips unknown keys', () => {
    const req = { body: { name: 'Cali', extra: 1 } } as unknown as Request;
    const next = vi.fn();
    validate(schema)(req, {} as unknown as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Cali' });
  });

  it('rejects an invalid body with VALIDATION_ERROR (400)', () => {
    const req = { body: {} } as unknown as Request;
    const next = vi.fn();
    validate(schema)(req, {} as unknown as Response, next);
    const err = next.mock.calls[0]?.[0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(400);
  });
});
