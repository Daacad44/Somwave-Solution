import { describe, expect, it } from 'vitest';
import { assertNewPasswordAllowed } from './password-policy';

describe('offline common-password check', () => {
  it('accepts a strong password without an external network request', async () => {
    await expect(assertNewPasswordAllowed('Mosaic!7River8')).resolves.toBeUndefined();
  });

  it('rejects a known common password even with added capitalization and punctuation', async () => {
    await expect(assertNewPasswordAllowed('Superman123!')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects a name or email identifier', async () => {
    await expect(
      assertNewPasswordAllowed('Ayaan!Mosaic27', {
        name: 'Ayaan Ali',
        email: 'ayaan@example.com',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
