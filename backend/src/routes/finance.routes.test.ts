import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { PERMISSIONS, ROLES } from '@somwave/shared';
import { AppError } from '../lib/http';
import { requireFinanceTwoFactor } from './finance.routes';

function call(enabled: boolean, verifiedAt: number | null = null) {
  const next = vi.fn() as unknown as NextFunction;
  const req = {
    financeMfaVerifiedAt: verifiedAt,
    authUser: {
      id: 'admin',
      email: 'admin@example.test',
      name: 'Test administrator',
      roles: [ROLES.SUPER_ADMIN],
      permissions: [PERMISSIONS.FINANCE_READ],
      clientId: null,
      twoFactorEnabled: enabled,
      twoFactorRequired: true,
    },
  } as Request;
  requireFinanceTwoFactor(req, {} as Response, next);
  return next as ReturnType<typeof vi.fn>;
}

describe('finance two-factor gate', () => {
  it('blocks even a super administrator without 2FA', () => {
    const next = call(false, Date.now());
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(403);
  });
  it('passes an enrolled finance user to permission checks', () => {
    expect(call(true, Date.now())).toHaveBeenCalledWith();
  });
  it('blocks an enrolled user whose session did not pass the 2FA challenge', () => {
    const next = call(true);
    expect((next.mock.calls[0]?.[0] as AppError).status).toBe(403);
  });
});
