import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, type AuthUser } from '@somwave/shared';
import { formatTrend, greetingFor, seriesHasValues, visibleQuickActions } from './metrics';

function user(permissions: AuthUser['permissions']): AuthUser {
  return {
    id: 'u1',
    email: 'a@b.com',
    name: 'Cali',
    roles: [ROLES.STAFF],
    permissions,
    clientId: null,
    twoFactorEnabled: false,
    twoFactorRequired: false,
  };
}

describe('dashboard metrics', () => {
  it('greets by hour of day', () => {
    expect(greetingFor(8)).toBe('Good morning');
    expect(greetingFor(14)).toBe('Good afternoon');
    expect(greetingFor(20)).toBe('Good evening');
  });

  it('does not treat an all-zero series as chartable', () => {
    expect(seriesHasValues([{ date: '2026-09-01', value: 0 }])).toBe(false);
    expect(seriesHasValues([{ date: '2026-09-01', value: 2 }])).toBe(true);
  });

  it('formats a real trend without inventing a plus on zero', () => {
    expect(formatTrend(-25)).toBe('-25%');
    expect(formatTrend(14)).toBe('+14%');
  });

  it('hides create actions the user cannot perform', () => {
    expect(visibleQuickActions(user([PERMISSIONS.PROJECTS_READ]))).toEqual([]);
    expect(visibleQuickActions(user([PERMISSIONS.PROJECTS_CREATE])).map((item) => item.to)).toEqual(
      ['/projects'],
    );
  });
});
