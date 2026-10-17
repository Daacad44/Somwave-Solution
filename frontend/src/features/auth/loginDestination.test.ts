import { describe, expect, it } from 'vitest';
import { PERMISSIONS, type AuthUser } from '@somwave/shared';
import { loginDestination } from './loginDestination';
const user: AuthUser = {
  id: '1',
  name: 'User',
  email: 'user@example.com',
  roles: [],
  permissions: [],
  clientId: null,
  twoFactorEnabled: true,
  twoFactorRequired: false,
};
describe('role login destinations', () => {
  it('routes authorized roles to their workspace', () => {
    expect(
      loginDestination({
        ...user,
        roles: ['ENGINEER'],
        permissions: [PERMISSIONS.ENGINEERING_READ],
      }),
    ).toBe('/engineering');
    expect(
      loginDestination({
        ...user,
        roles: ['CLIENT'],
        clientId: 'client',
        permissions: [PERMISSIONS.PORTAL_READ],
      }),
    ).toBe('/portal/projects');
    for (const role of ['FINANCE_MANAGER', 'ACCOUNTANT'])
      expect(
        loginDestination({ ...user, roles: [role], permissions: [PERMISSIONS.FINANCE_READ] }),
      ).toBe('/finance');
    expect(loginDestination({ ...user, roles: ['SUPER_ADMIN'] })).toBe('/');
  });
  it('requires MFA setup before protected finance and privileged workspaces', () => {
    expect(
      loginDestination({
        ...user,
        roles: ['FINANCE_MANAGER'],
        twoFactorRequired: true,
        twoFactorEnabled: false,
        permissions: [PERMISSIONS.FINANCE_READ],
      }),
    ).toBe('/profile?tab=security');
  });
  it('rejects unauthorized next paths and external redirects', () => {
    expect(loginDestination(user, '/engineering')).toBe('/');
    expect(loginDestination(user, '/portal/projects')).toBe('/');
    expect(loginDestination(user, 'https://evil.example')).toBe('/');
  });
});
