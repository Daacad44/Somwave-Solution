import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema } from './user';

describe('createUserSchema', () => {
  it('accepts an invitation without an administrator password', () => {
    const parsed = createUserSchema.parse({
      email: 'cali@example.com',
      name: 'Cali Axmed',
      roleIds: ['engineer'],
    });
    expect(parsed.roleIds).toEqual(['engineer']);
    expect(parsed).not.toHaveProperty('password');
  });
  it('requires an authorized role selection', () => {
    expect(
      createUserSchema.safeParse({ email: 'cali@example.com', name: 'Cali', roleIds: [] }).success,
    ).toBe(false);
  });

  it('rejects a bad email', () => {
    expect(
      createUserSchema.safeParse({ email: 'nope', name: 'Cali', password: 'Mosaic!7River8' })
        .success,
    ).toBe(false);
  });

  it('rejects legacy administrator-supplied passwords', () => {
    expect(
      createUserSchema.safeParse({
        email: 'cali@example.com',
        name: 'Cali',
        roleIds: ['engineer'],
        password: 'Mosaic!7River8',
      }).success,
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
