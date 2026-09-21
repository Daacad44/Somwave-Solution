import { type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from './hooks';
import { LoadingState } from '../../components/states/LoadingState';

export function ProtectedRoute(): ReactNode {
  const { data: user, isLoading, isError } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState label="Waa la hubinayaa fadhigaga" />;
  }
  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.twoFactorRequired && !user.twoFactorEnabled && location.pathname !== '/settings/2fa') {
    return <Navigate to="/settings/2fa" replace />;
  }
  return <Outlet />;
}
