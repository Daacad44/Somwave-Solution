import { type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PERMISSIONS, type PermissionKey } from '@somwave/shared';
import { useCurrentUser, useLogout } from '../../features/auth/hooks';
import { hasPermission } from '../../lib/rbac';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';

type NavItem = { to: string; label: string; permission: PermissionKey };

const CMS_LINKS: NavItem[] = [
  { to: '/cms/services', label: 'Adeegyada', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/posts', label: 'Maqaallada', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/portfolio', label: 'Shaqooyinka', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/careers', label: 'Fursadaha', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/testimonials', label: 'Marag-furka', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/team', label: 'Kooxda', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/faqs', label: 'Su’aalaha', permission: PERMISSIONS.CONTENT_READ },
  { to: '/cms/subscribers', label: 'Warsidaha', permission: PERMISSIONS.CONTENT_READ },
];

const INTERNAL_LINKS: NavItem[] = [
  { to: '/projects', label: 'Mashruucyada', permission: PERMISSIONS.PROJECTS_READ },
  { to: '/tasks', label: 'Hawlaha', permission: PERMISSIONS.TASKS_READ },
  { to: '/milestones', label: 'Marxaladaha', permission: PERMISSIONS.MILESTONES_READ },
  { to: '/clients', label: 'Macaamiisha', permission: PERMISSIONS.CLIENTS_READ },
  { to: '/leads', label: 'Lead-yada', permission: PERMISSIONS.LEADS_READ },
  { to: '/applications', label: 'Codsiyada shaqo', permission: PERMISSIONS.APPLICATIONS_READ },
  { to: '/timesheets', label: 'Saacadaha', permission: PERMISSIONS.TIMESHEETS_READ },
  { to: '/users', label: 'Isticmaalayaasha', permission: PERMISSIONS.USERS_READ },
  { to: '/roles', label: 'Doorar & rukhsado', permission: PERMISSIONS.ROLES_READ },
];

const PORTAL_LINKS: NavItem[] = [
  { to: '/portal/projects', label: 'Mashruucyadayda', permission: PERMISSIONS.PORTAL_READ },
  { to: '/invoices', label: 'Biilasha', permission: PERMISSIONS.INVOICES_READ },
  { to: '/tickets', label: 'Tikidhada', permission: PERMISSIONS.TICKETS_READ },
];

const GROUPS: { heading: string; items: NavItem[] }[] = [
  { heading: 'Websayd', items: CMS_LINKS },
  { heading: 'Gudaha', items: INTERNAL_LINKS },
  { heading: 'Portal', items: PORTAL_LINKS },
];

export function AppShell(): ReactNode {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const onLogout = async (): Promise<void> => {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-primary text-surface' : 'text-ink hover:bg-surface-alt',
    );

  return (
    <div className="min-h-screen bg-surface-alt">
      <header className="flex items-center justify-between gap-4 bg-primary px-4 py-3 text-surface">
        <span className="text-lg font-semibold">Somwave</span>
        <div className="flex items-center gap-3">
          <span className="text-sm">{user?.name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-surface hover:bg-primary-600"
            disabled={logout.isPending}
            onClick={onLogout}
          >
            {logout.isPending ? 'Waa la baxayaa…' : 'Ka bax'}
          </Button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl gap-6 p-4 md:p-6">
        <nav className="hidden w-52 shrink-0 flex-col gap-1 md:flex" aria-label="Navigation">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          {GROUPS.map((group) => {
            const items = group.items.filter((item) => hasPermission(user, item.permission));
            if (items.length === 0) return null;
            return (
              <div key={group.heading} className="mt-4">
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.heading}
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  {items.map((item) => (
                    <NavLink key={item.to} to={item.to} className={navLinkClass}>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
