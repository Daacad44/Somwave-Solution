import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes new passwords with Argon2id without truncating after 72 bytes', async () => {
    const first = `${'A'.repeat(73)}bc!9`;
    const second = `${'A'.repeat(73)}different!9`;
    const hash = await hashPassword(first);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(first, hash)).toBe(true);
    expect(await verifyPassword(second, hash)).toBe(false);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret-pw');
    expect(await verifyPassword('wrong-pw', hash)).toBe(false);
  });

  it('still verifies legacy bcrypt hashes', async () => {
    const hash = await bcrypt.hash('Legacy!Password9', 12);
    expect(await verifyPassword('Legacy!Password9', hash)).toBe(true);
    expect(await verifyPassword('different', hash)).toBe(false);
  });
});
