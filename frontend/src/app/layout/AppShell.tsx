import { type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PERMISSIONS } from '@somwave/shared';
import { useCurrentUser, useLogout } from '../../features/auth/hooks';
import { useHasPermission } from '../../lib/rbac';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';

// Authenticated chrome (SYSTEM_PROMPT §6: app/layout/). Feature routes render into
// the Outlet. Navigation grows — permission-gated — as features land (§13).
export function AppShell(): ReactNode {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const canReadUsers = useHasPermission(PERMISSIONS.USERS_READ);
  const canReadRoles = useHasPermission(PERMISSIONS.ROLES_READ);
  const canReadProjects = useHasPermission(PERMISSIONS.PROJECTS_READ);
  const canReadTasks = useHasPermission(PERMISSIONS.TASKS_READ);
  const canReadMilestones = useHasPermission(PERMISSIONS.MILESTONES_READ);
  const canReadContent = useHasPermission(PERMISSIONS.CONTENT_READ);

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
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl gap-6 p-4 md:p-6">
        <nav className="hidden w-48 shrink-0 flex-col gap-1 md:flex" aria-label="Navigation">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          {canReadProjects ? (
            <NavLink to="/projects" className={navLinkClass}>
              Mashruucyada
            </NavLink>
          ) : null}
          {canReadTasks ? (
            <NavLink to="/tasks" className={navLinkClass}>
              Hawlaha
            </NavLink>
          ) : null}
          {canReadMilestones ? (
            <NavLink to="/milestones" className={navLinkClass}>
              Marxaladaha
            </NavLink>
          ) : null}
          {canReadContent ? (
            <NavLink to="/cms/services" className={navLinkClass}>
              CMS · Adeegyada
            </NavLink>
          ) : null}
          {canReadContent ? (
            <NavLink to="/cms/posts" className={navLinkClass}>
              CMS · Maqaallada
            </NavLink>
          ) : null}
          {canReadUsers ? (
            <NavLink to="/users" className={navLinkClass}>
              Isticmaalayaasha
            </NavLink>
          ) : null}
          {canReadRoles ? (
            <NavLink to="/roles" className={navLinkClass}>
              Doorar &amp; rukhsado
            </NavLink>
          ) : null}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
