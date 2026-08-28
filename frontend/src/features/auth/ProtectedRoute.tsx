// Route guard. Hiding a route is UX, not security — the backend re-checks every
// request (SYSTEM_PROMPT §13). Renders an Outlet so a layout route can wrap it.
import { type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from './hooks';
import { LoadingState } from '../../components/states/LoadingState';

export function ProtectedRoute(): ReactNode {
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return <LoadingState label="Checking your session" />;
  }
  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
