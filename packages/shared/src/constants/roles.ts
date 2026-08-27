// The fixed set of roles (SYSTEM_PROMPT §17). Stored as Role.name in the database
// and referenced by RBAC on both server and client.
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
  EDITOR: 'EDITOR',
  CLIENT: 'CLIENT',
  GUEST: 'GUEST',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// Roles for which 2FA is mandatory (§13).
export const TWO_FACTOR_REQUIRED_ROLES: readonly RoleName[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MANAGER,
];
