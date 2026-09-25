import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

/** Legacy /settings/2fa bookmarks now live under Profile → Security. */
export function TwoFactorSetupPage(): ReactNode {
  return <Navigate to="/profile?tab=security" replace />;
}
