// Users & roles feature API (I1, §6: features/<feature>/api.ts → apiClient).
import type {
  AdminUser,
  AdminRole,
  CreateUserInput,
  UpdateUserInput,
  RoleDetail,
  Permission,
} from '@somwave/shared';
import { apiFetch, apiFetchPaged, type PaginationMeta } from '../../lib/apiClient';

export interface ListUsersParams {
  page: number;
  pageSize: number;
  search?: string;
}

export async function listUsers(
  params: ListUsersParams,
): Promise<{ data: AdminUser[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set('search', params.search);
  return apiFetchPaged<AdminUser[]>(`/users?${query.toString()}`);
}

export function listRoles(): Promise<AdminRole[]> {
  return apiFetch<AdminRole[]>('/roles');
}

export function createUser(input: CreateUserInput): Promise<AdminUser> {
  return apiFetch<AdminUser>('/users', { method: 'POST', body: JSON.stringify(input) });
}

export function updateUser(id: string, input: UpdateUserInput): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deactivateUser(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' });
}

// ── Roles & permissions (I1.2) ────────────────────────────────────────────────

export function getRole(id: string): Promise<RoleDetail> {
  return apiFetch<RoleDetail>(`/roles/${id}`);
}

export function listPermissions(): Promise<Permission[]> {
  return apiFetch<Permission[]>('/permissions');
}

export function setRolePermissions(id: string, permissionKeys: string[]): Promise<RoleDetail> {
  return apiFetch<RoleDetail>(`/roles/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionKeys }),
  });
}
