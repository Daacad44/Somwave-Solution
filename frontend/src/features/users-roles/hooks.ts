// Users & roles hooks (I1, §4: server state via TanStack Query, no global store).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInput, UpdateUserInput } from '@somwave/shared';
import {
  listUsers,
  listRoles,
  createUser,
  updateUser,
  deactivateUser,
  getRole,
  listPermissions,
  setRolePermissions,
  type ListUsersParams,
} from './api';

const USERS_KEY = ['users'] as const;
const ROLES_KEY = ['roles'] as const;
const PERMISSIONS_KEY = ['permissions'] as const;

export function useUsers(params: ListUsersParams) {
  return useQuery({
    queryKey: [...USERS_KEY, params],
    queryFn: () => listUsers(params),
    placeholderData: (prev) => prev,
  });
}

export function useRoles() {
  return useQuery({ queryKey: ROLES_KEY, queryFn: listRoles, staleTime: 5 * 60_000 });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

// ── Roles & permissions (I1.2) ────────────────────────────────────────────────

export function useRole(id: string | null) {
  return useQuery({
    queryKey: [...ROLES_KEY, id],
    queryFn: () => getRole(id as string),
    enabled: Boolean(id),
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: PERMISSIONS_KEY,
    queryFn: listPermissions,
    staleTime: 5 * 60_000,
  });
}

export function useSetRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissionKeys }: { id: string; permissionKeys: string[] }) =>
      setRolePermissions(id, permissionKeys),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  });
}
