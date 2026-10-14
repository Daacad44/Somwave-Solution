import { dictionary } from '@zxcvbn-ts/language-common';
import { newPasswordSchema, passwordPolicyStatus, type PasswordIdentity } from '@somwave/shared';
import { AppError } from './http';

const knownCommonPasswords = new Set(dictionary['passwords-common']);

/** Checks a new credential only; existing bcrypt passwords remain valid at login. */
export async function assertNewPasswordAllowed(
  password: string,
  identity: PasswordIdentity = {},
): Promise<void> {
  const parsed = newPasswordSchema.safeParse(password);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 400, parsed.error.issues[0]?.message);
  }
  if (!passwordPolicyStatus(password, identity).private) {
    throw new AppError('VALIDATION_ERROR', 400, 'Do not use your name or email in the password');
  }

  // An offline corpus of ~49,000 known common passwords avoids a runtime
  // dependency on an external breach API during account activation.
  const normalized = password.toLowerCase();
  if (
    knownCommonPasswords.has(normalized) ||
    knownCommonPasswords.has(normalized.replace(/[^a-z0-9]/g, ''))
  ) {
    throw new AppError('VALIDATION_ERROR', 400, 'Choose a less common password');
  }
}
