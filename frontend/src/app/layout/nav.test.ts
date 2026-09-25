import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@somwave/shared';
import { PERMISSIONS, ROLES } from '@somwave/shared';
import { hasInternalSurface, visibleNavGroups } from './nav';

function user(partial: Partial<AuthUser> & Pick<AuthUser, 'permissions'>): AuthUser {
  return {
    id: 'u1',
    email: 'a@b.com',
    name: 'Cali',
    roles: partial.roles ?? [ROLES.STAFF],
    permissions: partial.permissions,
    clientId: partial.clientId ?? null,
    twoFactorEnabled: false,
    twoFactorRequired: false,
  };
}

function paths(heading: string, groups: ReturnType<typeof visibleNavGroups>): string[] {
  return groups.find((group) => group.heading === heading)?.items.map((item) => item.to) ?? [];
}

describe('visibleNavGroups', () => {
  it('keeps a client on the Portal group only', () => {
    const client = user({
      roles: [ROLES.CLIENT],
      clientId: 'cl_1',
      permissions: [
        PERMISSIONS.PORTAL_READ,
        PERMISSIONS.TICKETS_READ,
        PERMISSIONS.TICKETS_CREATE,
        PERMISSIONS.INVOICES_READ,
        PERMISSIONS.PAYMENTS_READ,
        PERMISSIONS.PAYMENTS_CREATE,
        PERMISSIONS.DOCUMENTS_READ,
        PERMISSIONS.NOTIFICATIONS_READ,
      ],
    });
    expect(hasInternalSurface(client)).toBe(false);
    const groups = visibleNavGroups(client);
    expect(groups.map((group) => group.heading)).toEqual(['Portal']);
    expect(paths('Portal', groups)).toEqual([
      '/portal/projects',
      '/portal/milestones',
      '/tickets',
      '/invoices',
      '/documents',
    ]);
    expect(paths('Operations', groups)).toEqual([]);
  });

  it('hides portal project links when portal.read is present but clientId is missing', () => {
    const client = user({
      roles: [ROLES.CLIENT],
      clientId: null,
      permissions: [PERMISSIONS.PORTAL_READ, PERMISSIONS.TICKETS_READ, PERMISSIONS.INVOICES_READ],
    });
    expect(paths('Portal', visibleNavGroups(client))).toEqual(['/tickets', '/invoices']);
  });

  it('shows Website only for content permissions', () => {
    const editor = user({
      roles: [ROLES.EDITOR],
      permissions: [PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_UPDATE],
    });
    const groups = visibleNavGroups(editor);
    expect(groups.map((group) => group.heading)).toEqual(['Website']);
    expect(paths('Website', groups)).toContain('/cms/services');
    expect(paths('Operations', groups)).toEqual([]);
  });

  it('shows Operations modules a staff member can actually open', () => {
    const staff = user({
      permissions: [
        PERMISSIONS.PROJECTS_READ,
        PERMISSIONS.TASKS_READ,
        PERMISSIONS.MILESTONES_READ,
        PERMISSIONS.TIMESHEETS_READ,
        PERMISSIONS.TICKETS_READ,
        PERMISSIONS.TICKETS_UPDATE,
      ],
    });
    const groups = visibleNavGroups(staff);
    expect(groups.map((group) => group.heading)).toEqual(['Operations']);
    expect(paths('Operations', groups)).toEqual([
      '/projects',
      '/tasks',
      '/milestones',
      '/timesheets',
      '/tickets',
    ]);
  });

  it('does not duplicate invoices on Portal when the user already has Operations', () => {
    const manager = user({
      roles: [ROLES.MANAGER],
      permissions: [
        PERMISSIONS.PROJECTS_READ,
        PERMISSIONS.INVOICES_READ,
        PERMISSIONS.TICKETS_READ,
        PERMISSIONS.PORTAL_READ,
      ],
    });
    const groups = visibleNavGroups(manager);
    expect(paths('Operations', groups)).toEqual(['/projects', '/tickets', '/invoices']);
    expect(paths('Portal', groups)).toEqual([]);
  });

  it('never exposes a standalone Security item', () => {
    const admin = user({
      roles: [ROLES.SUPER_ADMIN],
      permissions: [PERMISSIONS.PROJECTS_READ, PERMISSIONS.CONTENT_READ],
    });
    const labels = visibleNavGroups(admin).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).not.toContain('Security');
  });
});
