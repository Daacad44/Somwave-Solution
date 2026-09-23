import { z } from 'zod';
import { TWO_FACTOR_REQUIRED_ROLES, type RoleName } from '../constants/roles';

export const loginSchema = z.object({
  email: z.string().email('Iimayl sax ah geli'),
  password: z.string().min(1, 'Furaha waa waajib'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const twoFactorCodeSchema = z.string().regex(/^\d{6}$/, 'Koodhka waa inuu noqdaa 6 lambar');

export const verifyTwoFactorSchema = z.object({
  challengeToken: z.string().min(1, 'Fadlan mar kale isku day'),
  code: twoFactorCodeSchema,
});

export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;

export const confirmTwoFactorSchema = z.object({
  code: twoFactorCodeSchema,
});

export type ConfirmTwoFactorInput = z.infer<typeof confirmTwoFactorSchema>;

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
