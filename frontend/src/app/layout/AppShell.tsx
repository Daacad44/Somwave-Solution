import { type ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../../features/auth/hooks';
import { Button } from '../../components/ui/Button';

// Authenticated chrome (SYSTEM_PROMPT §6: app/layout/). Feature routes render into
// the Outlet. Navigation grows as features land.
export function AppShell(): ReactNode {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const onLogout = async (): Promise<void> => {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

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
      <main className="mx-auto w-full max-w-5xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
