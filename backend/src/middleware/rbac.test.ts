import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { PERMISSIONS } from '@somwave/shared';
import { rbac } from './rbac';
import { AppError } from '../lib/http';

function runRbac(authUser: Request['authUser']) {
  const req = { authUser } as unknown as Request;
  const next = vi.fn();
  rbac(PERMISSIONS.USERS_READ)(req, {} as unknown as Response, next);
  return next;
}

describe('rbac', () => {
  it('calls next() when the permission is present', () => {
    const next = runRbac({ id: 'u', roles: [], permissions: [PERMISSIONS.USERS_READ] });
    expect(next).toHaveBeenCalledWith();
  });

  it('forbids with 403 when the permission is missing', () => {
    const next = runRbac({ id: 'u', roles: [], permissions: [] });
    const err = next.mock.calls[0]?.[0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('rejects with 401 when there is no authenticated user', () => {
    const next = runRbac(undefined);
    const err = next.mock.calls[0]?.[0] as AppError;
    expect(err.status).toBe(401);
  });
});
