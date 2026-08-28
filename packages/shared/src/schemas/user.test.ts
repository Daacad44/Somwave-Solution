import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema } from './user';

describe('createUserSchema', () => {
  it('accepts a valid new user and defaults roleIds to []', () => {
    const parsed = createUserSchema.parse({
      email: 'cali@example.com',
      name: 'Cali Axmed',
      password: 'a-strong-password',
    });
    expect(parsed.roleIds).toEqual([]);
  });

  it('rejects a password shorter than 12 characters', () => {
    expect(
      createUserSchema.safeParse({
        email: 'cali@example.com',
        name: 'Cali',
        password: 'short',
      }).success,
    ).toBe(false);
  });

  it('rejects a bad email', () => {
    expect(
      createUserSchema.safeParse({ email: 'nope', name: 'Cali', password: 'a-strong-password' })
        .success,
    ).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('accepts a partial update', () => {
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });
});
