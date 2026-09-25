import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '../constants/limits';
import { TWO_FACTOR_REQUIRED_ROLES, type RoleName } from '../constants/roles';

export const loginSchema = z.object({
  email: z.string().email('Iimayl sax ah geli'),
  password: z.string().min(1, 'Furaha waa waajib'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const twoFactorCodeSchema = z.string().regex(/^\d{6}$/, 'Koodhka waa inuu noqdaa 6 lambar');

export const verifyTwoFactorSchema = z.object({
  challengeToken: z.string().min(1, 'Fadlan mar kale isku day'),
  code: z.string().trim().min(6, 'Koodhka waa khalad').max(16),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Iimayl sax ah geli'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Fadlan isticmaal xiriirka iimaylka'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Furaha waa inuu noqdaa ugu yaraan ${PASSWORD_MIN_LENGTH} xaraf`),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;

export const confirmTwoFactorSchema = z.object({
  code: twoFactorCodeSchema,
});

export type ConfirmTwoFactorInput = z.infer<typeof confirmTwoFactorSchema>;

export const disableTwoFactorSchema = confirmTwoFactorSchema;
export type DisableTwoFactorInput = ConfirmTwoFactorInput;

export const regenerateBackupCodesSchema = confirmTwoFactorSchema;
export type RegenerateBackupCodesInput = ConfirmTwoFactorInput;

export const updateOwnProfileSchema = z.object({
  name: z.string().trim().min(1, 'Magaca waa waajib').max(120),
});

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Furaha hadda waa waajib'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Furaha waa inuu noqdaa ugu yaraan ${PASSWORD_MIN_LENGTH} xaraf`),
});

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;

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
