import { expect, test } from '@playwright/test';

test('authenticate once for browser checks', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(
    !email || !password,
    'Set E2E_EMAIL and E2E_PASSWORD for the local development account',
  );
  await page.goto('/login');
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.context().storageState({ path: 'test-results/.auth/user.json' });
});
