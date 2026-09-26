// Authorisation (SYSTEM_PROMPT §13: the backend re-checks every permission —
// hiding a button is not authorisation). Runs after requireAuth.
import type { NextFunction, Request, Response } from 'express';
import { holdsPermission, type PermissionKey } from '@somwave/shared';
import { AppError } from '../lib/http';

function authorize(permissions: readonly PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) {
      next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
      return;
    }
    if (!permissions.some((permission) => holdsPermission(user, permission))) {
      next(new AppError('FORBIDDEN', 403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}

export function rbac(permission: PermissionKey) {
  return authorize([permission]);
}

/** Allows the request when the user holds any one of the permissions. */
export function rbacAny(permissions: readonly PermissionKey[]) {
  return authorize(permissions);
}
