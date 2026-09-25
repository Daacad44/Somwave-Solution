import {
  PERMISSIONS,
  type AuthUser,
  type DashboardPoint,
  type PermissionKey,
} from '@somwave/shared';
import { hasPermission } from '../../lib/rbac';

export { formatRoleName } from '../../lib/name';

export function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function seriesHasValues(points: readonly DashboardPoint[]): boolean {
  return points.some((point) => point.value > 0);
}

export function formatTrend(percent: number): string {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent}%`;
}

export type QuickAction = {
  to: string;
  label: string;
  permission: PermissionKey;
};

export const QUICK_ACTIONS: QuickAction[] = [
  { to: '/projects', label: 'New Project', permission: PERMISSIONS.PROJECTS_CREATE },
  { to: '/tasks', label: 'New Task', permission: PERMISSIONS.TASKS_CREATE },
  { to: '/clients', label: 'Add Client', permission: PERMISSIONS.CLIENTS_CREATE },
  { to: '/invoices', label: 'Create Invoice', permission: PERMISSIONS.INVOICES_CREATE },
  { to: '/employees', label: 'Add Employee', permission: PERMISSIONS.EMPLOYEES_CREATE },
  { to: '/documents', label: 'Upload Document', permission: PERMISSIONS.DOCUMENTS_CREATE },
];

export function visibleQuickActions(user: AuthUser | null | undefined): QuickAction[] {
  return QUICK_ACTIONS.filter((action) => hasPermission(user, action.permission));
}

export const MODULE_COPY: Record<string, { title: string; description: string }> = {
  projects: { title: 'Projects', description: 'Manage active and completed projects' },
  tasks: { title: 'Tasks', description: 'Track work across all projects' },
  milestones: { title: 'Milestones', description: 'Delivery dates and checkpoints' },
  timesheets: { title: 'Timesheets', description: 'Logged hours against projects' },
  clients: { title: 'Clients', description: 'Companies you deliver work for' },
  leads: { title: 'Leads', description: 'Website enquiries waiting for follow-up' },
  tickets: { title: 'Tickets', description: 'Support conversations in progress' },
  invoices: { title: 'Invoices', description: 'Issued and outstanding invoices' },
  employees: { title: 'Employees', description: 'People on the Somwave team' },
  attendance: { title: 'Attendance', description: 'Daily check-in records' },
  leave: { title: 'Leave', description: 'Leave requests and time off' },
  applications: { title: 'Recruitment', description: 'Career applications from the website' },
  documents: { title: 'Documents', description: 'Files shared with clients' },
  users: { title: 'Users', description: 'People who can sign in' },
  roles: { title: 'Roles', description: 'Permission sets for staff and clients' },
  audit: { title: 'Audit', description: 'Recorded system events' },
  services: { title: 'Services', description: 'Website service pages' },
  posts: { title: 'Articles', description: 'Published and draft posts' },
};

export const DASHBOARD_RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
] as const;
