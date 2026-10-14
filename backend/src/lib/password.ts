// New passwords use Argon2id, which supports the full 128-character policy.
// Existing bcrypt hashes remain verifiable so users are not forced to reset.
import argon2 from 'argon2';
import bcrypt from 'bcrypt';

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$argon2id$')) return argon2.verify(hash, plain);
  if (!/^\$2[aby]\$/.test(hash)) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
