import { PERMISSIONS, type AuthUser, type PermissionKey } from '@somwave/shared';
import { hasPermission } from '../../lib/rbac';

export type NavItem = {
  to: string;
  label: string;
  permission: PermissionKey;
};

export type NavGroup = {
  heading: string;
  items: NavItem[];
};

const WEBSITE_ITEMS: NavItem[] = [
  { to: '/cms/services', label: 'Services', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/posts', label: 'Articles', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/portfolio', label: 'Portfolio', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/careers', label: 'Careers', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/testimonials', label: 'Testimonials', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/team', label: 'Team', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/faqs', label: 'FAQs', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/subscribers', label: 'Newsletter', permission: PERMISSIONS.CONTENT_READ },
  { to: '/media', label: 'Media', permission: PERMISSIONS.MEDIA_READ },
];

const OPERATIONS_ITEMS: NavItem[] = [
  { to: '/projects', label: 'Projects', permission: PERMISSIONS.PROJECTS_READ },
  { to: '/tasks', label: 'Tasks', permission: PERMISSIONS.TASKS_READ },
  { to: '/milestones', label: 'Milestones', permission: PERMISSIONS.MILESTONES_READ },
  { to: '/timesheets', label: 'Timesheets', permission: PERMISSIONS.TIMESHEETS_READ },
  { to: '/clients', label: 'Clients', permission: PERMISSIONS.CLIENTS_READ },
  { to: '/leads', label: 'Leads', permission: PERMISSIONS.LEADS_READ },
  { to: '/tickets', label: 'Tickets', permission: PERMISSIONS.TICKETS_READ },
  { to: '/invoices', label: 'Invoices', permission: PERMISSIONS.INVOICES_READ },
  { to: '/employees', label: 'Employees', permission: PERMISSIONS.EMPLOYEES_READ },
  { to: '/attendance', label: 'Attendance', permission: PERMISSIONS.ATTENDANCE_READ },
  { to: '/leave', label: 'Leave', permission: PERMISSIONS.LEAVE_READ },
  { to: '/applications', label: 'Applications', permission: PERMISSIONS.APPLICATIONS_READ },
  { to: '/documents', label: 'Documents', permission: PERMISSIONS.DOCUMENTS_READ },
  { to: '/users', label: 'Users', permission: PERMISSIONS.USERS_READ },
  { to: '/roles', label: 'Roles', permission: PERMISSIONS.ROLES_READ },
  { to: '/audit', label: 'Audit', permission: PERMISSIONS.AUDIT_READ },
];

const PORTAL_ITEMS: NavItem[] = [
  { to: '/portal/projects', label: 'My Projects', permission: PERMISSIONS.PORTAL_READ },
  { to: '/portal/milestones', label: 'Milestones', permission: PERMISSIONS.PORTAL_READ },
  { to: '/tickets', label: 'Tickets', permission: PERMISSIONS.TICKETS_READ },
  { to: '/invoices', label: 'Invoices', permission: PERMISSIONS.INVOICES_READ },
  { to: '/documents', label: 'Documents', permission: PERMISSIONS.DOCUMENTS_READ },
];

const INTERNAL_SURFACE_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.CONTENT_READ,
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.TASKS_READ,
  PERMISSIONS.MILESTONES_READ,
  PERMISSIONS.TIMESHEETS_READ,
  PERMISSIONS.CLIENTS_READ,
  PERMISSIONS.LEADS_READ,
  PERMISSIONS.APPLICATIONS_READ,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.ROLES_READ,
  PERMISSIONS.EMPLOYEES_READ,
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.LEAVE_READ,
  PERMISSIONS.MEDIA_READ,
  PERMISSIONS.AUDIT_READ,
];

export function hasInternalSurface(user: AuthUser | null | undefined): boolean {
  return INTERNAL_SURFACE_PERMISSIONS.some((permission) => hasPermission(user, permission));
}

function permitted(user: AuthUser | null | undefined, items: readonly NavItem[]): NavItem[] {
  return items.filter((item) => hasPermission(user, item.permission));
}

function pushGroup(groups: NavGroup[], heading: string, items: NavItem[]): void {
  if (items.length > 0) groups.push({ heading, items });
}

/** Sidebar groups for the signed-in user. Permission-gated; CLIENT stays off Operations. */
export function visibleNavGroups(user: AuthUser | null | undefined): NavGroup[] {
  const groups: NavGroup[] = [];
  pushGroup(groups, 'Website', permitted(user, WEBSITE_ITEMS));

  const isInternal = hasInternalSurface(user);
  if (isInternal) {
    pushGroup(groups, 'Operations', permitted(user, OPERATIONS_ITEMS));
  }

  if (hasPermission(user, PERMISSIONS.PORTAL_READ)) {
    const portal = PORTAL_ITEMS.filter((item) => {
      if (!hasPermission(user, item.permission)) return false;
      if (item.to.startsWith('/portal/') && !user?.clientId) return false;
      if (isInternal && (item.to === '/tickets' || item.to === '/invoices')) return false;
      if (isInternal && item.to === '/documents') return false;
      return true;
    });
    pushGroup(groups, 'Portal', portal);
  }

  return groups;
}

export const NAV_GROUPS: NavGroup[] = [
  { heading: 'Website', items: WEBSITE_ITEMS },
  { heading: 'Operations', items: OPERATIONS_ITEMS },
  { heading: 'Portal', items: PORTAL_ITEMS },
];
