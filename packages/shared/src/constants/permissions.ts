// Permission keys as `resource.action` (SYSTEM_PROMPT §5, §11 — the RBAC
// vocabulary the backend re-checks on every route). This set grows per feature.
export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',
  PROJECTS_READ: 'projects.read',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_UPDATE: 'projects.update',
  PROJECTS_DELETE: 'projects.delete',
  TASKS_READ: 'tasks.read',
  TASKS_CREATE: 'tasks.create',
  TASKS_UPDATE: 'tasks.update',
  TASKS_DELETE: 'tasks.delete',
  MILESTONES_READ: 'milestones.read',
  MILESTONES_CREATE: 'milestones.create',
  MILESTONES_UPDATE: 'milestones.update',
  MILESTONES_DELETE: 'milestones.delete',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
