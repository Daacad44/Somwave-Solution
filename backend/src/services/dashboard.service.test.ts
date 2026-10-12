import { describe, expect, it } from 'vitest';
import { resolveDashboardWindow, trendFromCounts, hasInternalSurface } from './dashboard.service';
import { PERMISSIONS, ROLES, type AuthUser } from '@somwave/shared';

describe('resolveDashboardWindow', () => {
  it('uses a 7-day window ending now with an equal previous window', () => {
    const now = new Date('2026-09-25T12:00:00.000Z');
    const window = resolveDashboardWindow('7d', now);
    expect(window.to.toISOString()).toBe(now.toISOString());
    expect(window.previousTo.getTime()).toBe(window.from.getTime());
    expect(window.to.getTime() - window.from.getTime()).toBeGreaterThan(5 * 86_400_000);
  });

  it('anchors this month to Africa/Mogadishu midnight', () => {
    const now = new Date('2026-09-25T12:00:00.000Z');
    const window = resolveDashboardWindow('this_month', now);
    expect(window.from.toISOString()).toBe('2026-08-31T21:00:00.000Z');
  });
});

describe('trendFromCounts', () => {
  it('returns null when the previous period has no baseline', () => {
    expect(trendFromCounts(8, 0)).toBeNull();
    expect(trendFromCounts(0, 0)).toBeNull();
  });

  it('computes a real current-vs-previous percentage', () => {
    expect(trendFromCounts(8, 4)).toBe(100);
    expect(trendFromCounts(3, 4)).toBe(-25);
  });
});

describe('hasInternalSurface', () => {
  it('keeps a portal-only client off the internal dashboard', () => {
    const client: AuthUser = {
      id: 'u1',
      email: 'c@b.com',
      name: 'Client',
      roles: [ROLES.CLIENT],
      permissions: [PERMISSIONS.PORTAL_READ, PERMISSIONS.TICKETS_READ, PERMISSIONS.INVOICES_READ],
      clientId: 'cl_1',
      twoFactorEnabled: false,
      twoFactorRequired: false,
    };
    expect(hasInternalSurface(client)).toBe(false);
  });
});
