import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock,
  BarChart3,
  FileText,
  Flag,
  Folder,
  Headphones,
  Home,
  Image,
  KeyRound,
  LayoutGrid,
  ListTodo,
  Mail,
  Menu,
  MessageSquare,
  Receipt,
  Search,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useCurrentUser, useLogout } from '../../features/auth/hooks';
import { cn } from '../../lib/cn';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { visibleNavGroups } from './nav';

const ICONS: Record<string, LucideIcon> = {
  '/cms/services': LayoutGrid,
  '/cms/posts': FileText,
  '/cms/portfolio': Image,
  '/cms/careers': Briefcase,
  '/cms/testimonials': MessageSquare,
  '/cms/team': Users,
  '/cms/faqs': CircleHelp,
  '/cms/subscribers': Mail,
  '/projects': Folder,
  '/tasks': ListTodo,
  '/milestones': Flag,
  '/clients': Building2,
  '/leads': BarChart3,
  '/applications': ClipboardList,
  '/timesheets': Clock,
  '/invoices': Receipt,
  '/tickets': Headphones,
  '/users': Users,
  '/roles': KeyRound,
  '/portal/projects': Folder,
  '/portal/milestones': Flag,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'SA'
  );
}

function headerRole(roles: readonly string[]): string {
  if (roles.includes('SUPER_ADMIN')) return 'Administrator';
  if (roles[0]) {
    return roles[0]
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return 'Administrator';
}

export function AppShell(): ReactNode {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: MouseEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  const onLogout = async (): Promise<void> => {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  const closeDrawer = (): void => {
    if (window.matchMedia('(max-width: 1023px)').matches) setOpen(false);
  };

  const linkClass = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
      isActive ? 'bg-brand text-surface' : 'text-surface hover:bg-white/10',
    );

  return (
    <div className="flex min-h-screen bg-canvas">
      {open ? (
        <button
          type="button"
          className="shell-scrim fixed inset-0 z-30 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        id="app-nav"
        className={cn(
          'fixed bottom-0 start-0 top-16 z-40 w-[272px] shrink-0 flex-col bg-sidebar text-surface print:hidden lg:sticky lg:top-0 lg:h-screen',
          open ? 'flex' : 'hidden',
        )}
      >
        <div className="flex items-center px-4 py-4">
          <BrandLogo className="w-[200px]" />
        </div>
        <nav
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4"
          aria-label="Navigation"
        >
          <NavLink to="/" end className={linkClass} onClick={closeDrawer}>
            <Home className="h-[18px] w-[18px]" aria-hidden="true" />
            Home
          </NavLink>
          <NavLink to="/settings/2fa" className={linkClass} onClick={closeDrawer}>
            <Shield className="h-[18px] w-[18px]" aria-hidden="true" />
            Security
          </NavLink>
          {visibleNavGroups(user).map((group) => (
            <div key={group.heading} className="mt-5">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
                {group.heading}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = ICONS[item.to] ?? Folder;
                  return (
                    <NavLink
                      key={`${group.heading}-${item.to}`}
                      to={item.to}
                      className={linkClass}
                      onClick={closeDrawer}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3">
          <div className="rounded-lg bg-white/5 px-3 py-3">
            <BrandLogo className="w-[168px]" />
            <p className="mt-2 text-xs leading-5 text-sidebar-muted">
              Building a brighter tomorrow with technology.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 print:hidden md:px-6">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-expanded={open}
            aria-controls="app-nav"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            onClick={() => setOpen((value) => !value)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <label className="relative hidden min-w-0 flex-1 sm:block sm:max-w-md">
            <span className="sr-only">Search</span>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search anything..."
              className="h-11 w-full rounded-lg border border-border bg-canvas ps-10 pe-16 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <kbd className="pointer-events-none absolute end-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted md:inline-flex">
              ⌘ K
            </kbd>
          </label>
          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="flex h-11 items-center gap-2 rounded-lg px-1.5 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-surface">
                  {initials(user?.name ?? 'Super Admin')}
                </span>
                <span className="hidden text-start sm:block">
                  <span className="block text-sm font-semibold leading-4 text-ink">
                    {user?.name}
                  </span>
                  <span className="block text-xs text-muted">{headerRole(user?.roles ?? [])}</span>
                </span>
                <ChevronDown className="hidden h-4 w-4 text-muted sm:block" aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute end-0 top-12 z-20 min-w-40 rounded-lg border border-border bg-surface p-1 shadow-md"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex min-h-11 w-full items-center rounded-md px-3 text-sm text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    disabled={logout.isPending}
                    onClick={onLogout}
                  >
                    {logout.isPending ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
