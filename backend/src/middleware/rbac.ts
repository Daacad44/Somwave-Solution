// Authorisation (SYSTEM_PROMPT §13: the backend re-checks every permission —
// hiding a button is not authorisation). Runs after requireAuth.
import type { NextFunction, Request, Response } from 'express';
import type { PermissionKey } from '@somwave/shared';
import { AppError } from '../lib/http';

export function rbac(permission: PermissionKey) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) {
      next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
      return;
    }
    if (!user.permissions.includes(permission)) {
      next(new AppError('FORBIDDEN', 403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}
