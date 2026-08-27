import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes with bcrypt cost 12 and verifies the correct password', async () => {
    const hash = await hashPassword('s3cret-pw');
    expect(hash).not.toBe('s3cret-pw');
    expect(hash.startsWith('$2b$12$')).toBe(true);
    expect(await verifyPassword('s3cret-pw', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret-pw');
    expect(await verifyPassword('wrong-pw', hash)).toBe(false);
  });
});
