import { PERMISSIONS, type AuthUser } from '@somwave/shared';

export function loginDestination(user: AuthUser, requested?: string | null): string {
  if (user.twoFactorRequired && !user.twoFactorEnabled) return '/profile?tab=security';
  if (
    requested === '/portal/projects' &&
    user.clientId &&
    user.permissions.includes(PERMISSIONS.PORTAL_READ)
  )
    return requested;
  if (requested === '/engineering' && user.permissions.includes(PERMISSIONS.ENGINEERING_READ))
    return requested;
  if (user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN')) return '/';
  if (user.roles.includes('CLIENT') && user.permissions.includes(PERMISSIONS.PORTAL_READ))
    return '/portal/projects';
  if (user.roles.includes('ENGINEER') && user.permissions.includes(PERMISSIONS.ENGINEERING_READ))
    return '/engineering';
  if (
    user.roles.some((role) => role === 'FINANCE_MANAGER' || role === 'ACCOUNTANT') &&
    user.permissions.includes(PERMISSIONS.FINANCE_READ)
  )
    return '/finance';
  return '/';
}
