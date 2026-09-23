import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../../features/auth/hooks';
import { hasPermission } from '../../lib/rbac';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { NAV_GROUPS } from './nav';

export function AppShell(): ReactNode {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const onLogout = async (): Promise<void> => {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors',
      isActive ? 'bg-primary text-surface' : 'text-ink hover:bg-surface-alt',
    );

  const closeNav = (): void => setNavOpen(false);

  return (
    <div className="min-h-screen bg-surface-alt">
      <header className="flex items-center justify-between gap-4 bg-primary px-4 py-3 text-surface print:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-surface hover:bg-primary-600 md:hidden"
            aria-expanded={navOpen}
            aria-controls="app-nav"
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? 'Close' : 'Menu'}
          </Button>
          <span className="text-lg font-semibold">Somwave</span>
        </div>
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:flex-row md:p-6">
        <nav
          id="app-nav"
          className={cn(
            'w-full shrink-0 flex-col gap-1 print:hidden md:flex md:w-56',
            navOpen ? 'flex' : 'hidden',
          )}
          aria-label="Navigation"
        >
          <NavLink to="/" end className={navLinkClass} onClick={closeNav}>
            Home
          </NavLink>
          <NavLink to="/settings/2fa" className={navLinkClass} onClick={closeNav}>
            Security
          </NavLink>
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => hasPermission(user, item.permission));
            if (items.length === 0) return null;
            return (
              <div key={group.heading} className="mt-4">
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.heading}
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  {items.map((item) => (
                    <NavLink key={item.to} to={item.to} className={navLinkClass} onClick={closeNav}>
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
