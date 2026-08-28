import { describe, it, expect } from 'vitest';
import type { AuthUser } from '@somwave/shared';
import { PERMISSIONS, ROLES } from '@somwave/shared';
import { hasPermission, hasRole } from './rbac';

const user: AuthUser = {
  id: 'u1',
  email: 'a@b.com',
  name: 'Cali',
  roles: [ROLES.STAFF],
  permissions: [PERMISSIONS.USERS_READ],
};

describe('hasPermission', () => {
  it('is true when the user holds the permission', () => {
    expect(hasPermission(user, PERMISSIONS.USERS_READ)).toBe(true);
  });
  it('is false when the user lacks it, or is absent', () => {
    expect(hasPermission(user, PERMISSIONS.USERS_DELETE)).toBe(false);
    expect(hasPermission(null, PERMISSIONS.USERS_READ)).toBe(false);
  });
});

describe('hasRole', () => {
  it('checks role membership', () => {
    expect(hasRole(user, ROLES.STAFF)).toBe(true);
    expect(hasRole(user, ROLES.ADMIN)).toBe(false);
  });
});
