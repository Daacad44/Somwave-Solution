import { type ReactNode } from 'react';
import type { AuthUser, PermissionKey, RoleName } from '@somwave/shared';
import { useCurrentUser } from '../features/auth/hooks';

// Client-side RBAC is for UX only — hiding a control is not authorisation; the
// backend re-checks every permission on every request (SYSTEM_PROMPT §13).

export function hasPermission(
  user: AuthUser | null | undefined,
  permission: PermissionKey,
): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function hasRole(user: AuthUser | null | undefined, role: RoleName): boolean {
  return Boolean(user?.roles.includes(role));
}

export function useHasPermission(permission: PermissionKey): boolean {
  const { data: user } = useCurrentUser();
  return hasPermission(user, permission);
}

// Renders children only when the current user holds the permission (no JSX here,
// so this stays a .ts module).
export function Can({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: ReactNode;
}): ReactNode {
  return useHasPermission(permission) ? children : null;
}
