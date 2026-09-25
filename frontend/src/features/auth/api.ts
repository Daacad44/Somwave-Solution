import type {
  AuthUser,
  ConfirmTwoFactorInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  VerifyTwoFactorInput,
} from '@somwave/shared';
import { apiFetch, ApiError } from '../../lib/apiClient';

export type LoginResponse =
  | { twoFactorRequired: true; challengeToken: string }
  | { twoFactorRequired?: false; user: AuthUser };

export function login(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function verifyTwoFactorLogin(input: VerifyTwoFactorInput): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>('/auth/login/2fa', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function startTwoFactorSetup(): Promise<{ otpauthUrl: string; secret: string }> {
  return apiFetch<{ otpauthUrl: string; secret: string }>('/auth/2fa/setup', { method: 'POST' });
}

export function confirmTwoFactorSetup(
  input: ConfirmTwoFactorInput,
): Promise<{ user: AuthUser; backupCodes: string[] }> {
  return apiFetch<{ user: AuthUser; backupCodes: string[] }>('/auth/2fa/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function disableTwoFactor(
  input: ConfirmTwoFactorInput,
): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function regenerateBackupCodes(
  input: ConfirmTwoFactorInput,
): Promise<{ backupCodes: string[] }> {
  return apiFetch<{ backupCodes: string[] }>('/auth/2fa/backup-codes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOwnProfile(input: { name: string }): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function changeOwnPassword(input: {
  currentPassword: string;
  password: string;
}): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function forgotPassword(input: ForgotPasswordInput): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function resetPassword(input: ResetPasswordInput): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/auth/logout', { method: 'POST' });
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const { user } = await apiFetch<{ user: AuthUser }>('/auth/me');
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'UNAUTHORIZED') return null;
    throw err;
  }
}
