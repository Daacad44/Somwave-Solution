// Route guard. Hiding a route is UX, not security — the backend re-checks every
// request (SYSTEM_PROMPT §13). The full loading/error state kit arrives in F0.4.
import { type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from './hooks';

export function ProtectedRoute(): ReactNode {
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return <main className="auth-shell">Loading…</main>;
  }
  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
