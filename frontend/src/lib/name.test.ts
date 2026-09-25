import { describe, expect, it } from 'vitest';
import { formatRoleName, initials } from './name';

describe('name helpers', () => {
  it('builds initials from the first two names', () => {
    expect(initials('Super Admin')).toBe('SA');
    expect(initials('')).toBe('SA');
  });

  it('formats stored roles for display', () => {
    expect(formatRoleName('SUPER_ADMIN')).toBe('Super Admin');
  });
});
