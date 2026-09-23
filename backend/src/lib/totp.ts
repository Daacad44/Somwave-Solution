// TOTP helpers (SYSTEM_PROMPT §13). Never log the secret or a live code.
import { generateSecret, generateURI, verify } from 'otplib';

const ISSUER = 'Somwave';

export function createTotpSecret(): string {
  return generateSecret();
}

export function totpUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  const result = await verify({ secret, token, epochTolerance: 30 });
  return result.valid;
}
