import { type ReactNode } from 'react';
import type { PermissionKey } from '@somwave/shared';
import { ErrorState } from '../../components/states/ErrorState';
import { hasPermission } from '../../lib/rbac';
import { useCurrentUser } from './hooks';

export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: ReactNode;
}): ReactNode {
  const { data: user } = useCurrentUser();
  if (!hasPermission(user, permission)) {
    return (
      <ErrorState title="Permission denied" description="You do not have access to this area." />
    );
  }
  return children;
}
