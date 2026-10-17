import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

async function expectFits(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}

test('account invitation verifies before password activation and removes token from URL', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/user-invitations/verify', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ token: 'browser-invitation' });
    await route.fulfill({ json: { data: { name: 'Ayaan Ali', email: 'ayaan@example.test' } } });
  });
  let activationCount = 0;
  await page.route('**/api/v1/auth/user-invitations/activate', async (route) => {
    activationCount++;
    expect(route.request().postDataJSON()).toEqual({
      token: 'browser-invitation',
      password: 'Mosaic!7River8',
    });
    await route.fulfill({ json: { data: { ok: true } } });
  });
  await page.goto('/activate-account?token=browser-invitation');
  await expect(page.getByLabel('New password')).toHaveCount(0);
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page).toHaveURL(/\/activate-account$/);
  await page.getByLabel('New password', { exact: true }).fill('Mosaic!7River8');
  await page.getByLabel('Confirm password').fill('Different!9River');
  await page.getByRole('button', { name: 'Activate account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
  expect(activationCount).toBe(0);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('type', 'text');
  await expectFits(page);
  await page.getByLabel('Confirm password').fill('Mosaic!7River8');
  await page.getByRole('button', { name: 'Activate account' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Your account is active' }),
  ).toBeVisible();
  expect(activationCount).toBe(1);
});

test('password recovery requires OTP, handles invalid code, and confirms session revocation', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/forgot-password', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: 'ayaan@example.test' });
    await route.fulfill({ json: { data: { ok: true } } });
  });
  await page.route('**/api/v1/auth/password-reset/verify', async (route) => {
    const input = route.request().postDataJSON();
    await route.fulfill(
      input.code === '123456'
        ? { json: { data: { token: 'browser-reset-proof' } } }
        : {
            status: 400,
            json: {
              error: { code: 'VALIDATION_ERROR', message: 'Invalid or expired verification code' },
            },
          },
    );
  });
  await page.route('**/api/v1/auth/reset-password', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      token: 'browser-reset-proof',
      password: 'Mosaic!7River8',
    });
    await route.fulfill({ json: { data: { ok: true } } });
  });
  await page.goto('/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill('ayaan@example.test');
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await expect(page.getByRole('button', { name: /Resend code in/ })).toBeDisabled();
  await expect(page.getByLabel('New password')).toHaveCount(0);
  await page.getByLabel('Verification code').fill('000000');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid or expired verification code');
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await page.getByLabel('New password', { exact: true }).fill('Mosaic!7River8');
  await page.getByLabel('Confirm password').fill('Mosaic!7River8');
  await expectFits(page);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'previous sessions have ended' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
    'href',
    '/login',
  );
});
