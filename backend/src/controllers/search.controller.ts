import type { NextFunction, Request, Response } from 'express';
import { searchQuerySchema } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { searchRecords } from '../services/search.service';

export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.authUser;
    if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const parsed = searchQuerySchema.safeParse({
      q: typeof req.query.q === 'string' ? req.query.q : '',
    });
    if (!parsed.success) {
      sendData(res, []);
      return;
    }
    sendData(
      res,
      await searchRecords(parsed.data.q, {
        permissions: user.permissions,
        roles: user.roles,
        clientId: user.clientId,
      }),
    );
  } catch (err) {
    next(err);
  }
}
