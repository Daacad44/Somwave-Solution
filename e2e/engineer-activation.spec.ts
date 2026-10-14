import { expect, test } from '@playwright/test';

test('engineer activation shows password guidance and fits the viewport', async ({ page }) => {
  await page.route('**/api/v1/auth/engineer-invitations/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          activationToken: 'a'.repeat(64),
          name: 'Ayaan Ali',
          email: 'ayaan@example.com',
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          existingAccount: false,
          profile: null,
        },
      }),
    });
  });
  await page.route('**/api/v1/auth/engineer-invitations/activate', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      activationToken: 'a'.repeat(64),
      confirmPassword: 'Mosaic!7River8',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    });
  });
  await page.goto('/activate-engineer?token=test-invitation');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByText('Password requirements')).toBeVisible();
  await expect(page.getByText('Use 12 to 128 characters')).toBeVisible();
  await page.getByLabel('Create password').fill('Mosaic!7River8');
  await expect(page.getByText('Password strength: Strong')).toBeVisible();
  await page.getByLabel('Confirm password').fill('wrong');
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Create password')).toHaveAttribute('type', 'text');
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflows).toBe(false);
  await page.getByLabel('Job title').fill('Backend Engineer');
  await page.getByLabel('Engineering specialization').fill('Backend');
  await page.getByLabel('Confirm password').fill('Mosaic!7River8');
  await page.getByRole('button', { name: 'Activate account' }).click();
  await expect(
    page.getByRole('link', { name: 'Sign in to Engineering Workspace' }),
  ).toHaveAttribute('href', '/login?next=%2Fengineering');
});
