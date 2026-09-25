import type { NextFunction, Request, Response } from 'express';
import { dashboardQuerySchema } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as dashboardService from '../services/dashboard.service';

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.authUser;
    if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const parsed = dashboardQuerySchema.safeParse({
      range: typeof req.query.range === 'string' ? req.query.range : undefined,
    });
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Validation failed', parsed.error.flatten());
    }
    sendData(res, await dashboardService.getDashboard(user, parsed.data.range));
  } catch (err) {
    next(err);
  }
}
