import { type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from './hooks';
import { LoadingState } from '../../components/states/LoadingState';

export function ProtectedRoute(): ReactNode {
  const { data: user, isLoading, isError } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState label="Checking your session" />;
  }
  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }
  const onProfile =
    location.pathname === '/profile' || location.pathname.startsWith('/profile/');
  if (user.twoFactorRequired && !user.twoFactorEnabled && !onProfile) {
    return <Navigate to="/profile?tab=security" replace />;
  }
  return <Outlet />;
}
