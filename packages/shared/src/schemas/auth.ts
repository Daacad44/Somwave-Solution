import { z } from 'zod';
import { TWO_FACTOR_REQUIRED_ROLES, type RoleName } from '../constants/roles';
import { newPasswordSchema } from './password';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const twoFactorCodeSchema = z.string().regex(/^\d{6}$/, 'Code must have 6 digits');

export const verifyTwoFactorSchema = z.object({
  challengeToken: z.string().min(1, 'Please try again'),
  code: z.string().trim().min(6, 'Invalid code').max(16),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Please use the link in the email'),
  password: newPasswordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;

export const confirmTwoFactorSchema = z.object({
  code: twoFactorCodeSchema,
});

export type ConfirmTwoFactorInput = z.infer<typeof confirmTwoFactorSchema>;

export const disableTwoFactorSchema = z.object({
  code: z.string().trim().min(6, 'Invalid code').max(16),
});

export type DisableTwoFactorInput = z.infer<typeof disableTwoFactorSchema>;

export const regenerateBackupCodesSchema = confirmTwoFactorSchema;
export type RegenerateBackupCodesInput = z.infer<typeof regenerateBackupCodesSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  clientId: string | null;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
}

export function isTwoFactorRequired(roles: readonly string[]): boolean {
  return roles.some((role) =>
    (TWO_FACTOR_REQUIRED_ROLES as readonly string[]).includes(role as RoleName),
  );
}
