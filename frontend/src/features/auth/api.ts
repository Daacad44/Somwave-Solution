// Auth feature API calls (SYSTEM_PROMPT §6: features/<feature>/api.ts → apiClient).
import type { AuthUser, LoginInput } from '@somwave/shared';
import { apiFetch, ApiError } from '../../lib/apiClient';

export function login(input: LoginInput): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/auth/logout', { method: 'POST' });
}

// Returns null (not an error) when the visitor is simply not authenticated.
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const { user } = await apiFetch<{ user: AuthUser }>('/auth/me');
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'UNAUTHORIZED') return null;
    throw err;
  }
}
