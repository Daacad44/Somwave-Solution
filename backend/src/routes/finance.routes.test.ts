import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { PERMISSIONS, ROLES } from '@somwave/shared';
import { AppError } from '../lib/http';
import { parseFinanceHistoryQuery, requireFinanceTwoFactor } from './finance.routes';

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

describe('finance history query validation', () => {
  const parse = (query: Record<string, unknown>, kind: 'transactions' | 'journals') =>
    kind === 'transactions'
      ? parseFinanceHistoryQuery({ query } as unknown as Request, 'transactions')
      : parseFinanceHistoryQuery({ query } as unknown as Request, 'journals');

  it('parses bounded pagination and half-open UTC dates', () => {
    expect(
      parse(
        {
          page: '2',
          pageSize: '50',
          from: '2026-01-01',
          to: '2026-02-01',
          status: 'SUBMITTED,APPROVED',
        },
        'transactions',
      ),
    ).toMatchObject({
      page: 2,
      pageSize: 50,
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-02-01T00:00:00.000Z'),
      statuses: ['SUBMITTED', 'APPROVED'],
    });
  });

  it('rejects invalid dates, huge pages, unsupported filters and repeated query values', () => {
    for (const query of [
      { from: '2026-02-30' },
      { from: '2026-03-01', to: '2026-03-01' },
      { page: '10001' },
      { pageSize: '101' },
      { accountId: ['a', 'b'] },
      { currency: 'usd' },
      { sourceType: 'REVERSAL' },
    ]) {
      expect(() => parse(query, 'transactions')).toThrow(AppError);
    }
  });

  it('limits journal source to supported values', () => {
    expect(parse({ sourceType: 'REVERSAL', search: 'REV-' }, 'journals')).toMatchObject({
      sourceType: 'REVERSAL',
      search: 'REV-',
    });
    expect(() => parse({ sourceType: 'UNKNOWN' }, 'journals')).toThrow(AppError);
  });
});
