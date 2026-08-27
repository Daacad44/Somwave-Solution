// Boundary validation from a shared Zod schema (SYSTEM_PROMPT §5, §11). On
// failure it produces the VALIDATION_ERROR envelope via the central handler.
import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../lib/http';

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError('VALIDATION_ERROR', 400, 'Validation failed', result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}
