import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants/limits';

const commonPasswords = new Set([
  'password',
  'password1',
  'password123',
  'qwerty',
  'qwerty123',
  'letmein',
  'welcome',
  'welcome123',
  'admin',
  'admin123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'iloveyou',
  'changeme',
  'somwave',
  'somwave123',
]);

export interface PasswordIdentity {
  name?: string;
  email?: string;
}

export function passwordPolicyStatus(password: string, identity: PasswordIdentity = {}) {
  const normalized = password.toLowerCase();
  const tokens = [
    ...(identity.name?.toLowerCase().match(/[a-z0-9]+/g) ?? []),
    identity.email?.split('@')[0]?.toLowerCase(),
  ].filter((token): token is string => Boolean(token && token.length >= 3));
  return {
    length: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    uncommon: !commonPasswords.has(normalized.replace(/[^a-z0-9]/g, '')),
    private: !tokens.some((token) => normalized.includes(token)),
  };
}

export const newPasswordSchema = z.string().superRefine((password, ctx) => {
  const status = passwordPolicyStatus(password);
  const requirements: Array<[keyof typeof status, string]> = [
    ['length', 'Use 12 to 128 characters'],
    ['uppercase', 'Include an uppercase letter'],
    ['lowercase', 'Include a lowercase letter'],
    ['number', 'Include a number'],
    ['special', 'Include a special character'],
    ['uncommon', 'Choose a less common password'],
  ];
  for (const [key, message] of requirements) {
    if (!status[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }
});
