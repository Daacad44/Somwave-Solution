import { expect, test } from '@playwright/test';
import { generateSync } from 'otplib';

test('engineering modules load from real APIs', async ({ page }, testInfo) => {
  for (const [path, title] of [
    ['/engineering', 'Engineering Workspace'],
    ['/engineering/planning', 'Task planning'],
    ['/engineering/documentation', 'Project documentation'],
    ['/engineering/operations', 'Engineering operations'],
    ['/engineering/engineers', 'Engineer management'],
    ['/engineering/analytics', 'Engineering analytics'],
    ['/github', 'GitHub integration'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByText('Could not load projects.')).toHaveCount(0);
    if (path === '/engineering/engineers' || path === '/engineering/analytics') {
      await page.screenshot({
        path: testInfo.outputPath(`${path.split('/').pop()}.png`),
        fullPage: true,
      });
    }
  }
});

test('navigation, responsive layout, and theme switch work', async ({ page }, testInfo) => {
  await page.goto('/engineering/planning');
  const before = await page
    .locator('body')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
  const after = await page
    .locator('body')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(after).not.toBe(before);
  await page.screenshot({ path: testInfo.outputPath('engineering-planning.png'), fullPage: true });
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible();
    await page.locator('#app-nav').getByRole('button', { name: 'Close navigation' }).click();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  }
});

test('engineer directory filters and registration form are usable', async ({ page }) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const adminTotpSecret = process.env.E2E_ADMIN_TOTP_SECRET;
  test.skip(
    !adminEmail || !adminPassword || !adminTotpSecret,
    'Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, and E2E_ADMIN_TOTP_SECRET for admin UI checks',
  );
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(adminEmail!);
  await page.getByLabel('Password', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your sign-in' })).toBeVisible();
  await page.getByLabel('2FA code').fill(generateSync({ secret: adminTotpSecret! }));
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/engineering/engineers');
  await expect(page.getByRole('heading', { name: 'Engineer management' })).toBeVisible();
  const directory = page.getByRole('region', { name: 'Engineering team directory' });
  await expect(directory).toBeVisible();
  await expect(directory.getByLabel('Search engineers')).toBeVisible();
  await directory.getByLabel('Filter account status').selectOption('ACTIVE');
  await directory.getByLabel('Filter availability').selectOption('AVAILABLE');
  await directory.getByLabel('Search engineers').fill('browser-e2e-no-match@example.invalid');
  await expect(directory.getByText(/No matching engineers|No engineers registered/)).toBeVisible();
  await directory.getByLabel('Search engineers').clear();
  await directory.getByLabel('Filter account status').selectOption('ALL');
  await directory.getByLabel('Filter availability').selectOption('ALL');

  await directory.getByRole('button', { name: 'Register engineer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Register engineer' });
  await expect(dialog.getByLabel('Full name')).toBeVisible();
  await expect(dialog.getByLabel('Email address')).toBeVisible();
  await expect(dialog.getByLabel('Weekly working hours')).toBeVisible();
  const sendInvitation = dialog.getByRole('button', { name: 'Send invitation' });
  await expect(
    dialog.getByText(/Resend settings are present|Email is not configured/),
  ).toBeVisible();
  if (await sendInvitation.isEnabled()) {
    await sendInvitation.click();
    await expect(dialog.getByLabel('Full name')).toBeFocused();
  } else {
    await expect(dialog.getByRole('alert')).toContainText(
      /RESEND_API_KEY|EMAIL_FROM|APP_PUBLIC_URL/,
    );
  }
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  const firstProfile = directory.getByRole('link', { name: 'View profile' }).first();
  await expect(firstProfile).toBeVisible();
  await firstProfile.click();
  await expect(
    page.getByRole('heading', { name: 'Workload and performance context' }),
  ).toBeVisible();
  const skillsSection = page.getByRole('region', { name: 'Engineer skills and schedule' });
  await expect(skillsSection.getByRole('heading', { name: 'Technical skills' })).toBeVisible();
  await expect(
    skillsSection.getByRole('heading', { name: 'Weekly working schedule' }),
  ).toBeVisible();
});

test('public engineer activation rejects missing and invalid links', async ({ page }) => {
  await page.goto('/activate-engineer');
  await expect(page.getByRole('heading', { name: 'Activate engineer account' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('invitation link is incomplete');
  await expect(page.getByRole('button', { name: 'Verify email' })).toHaveCount(0);

  await page.goto('/activate-engineer?token=browser-e2e-invalid-token');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activate account' })).toHaveCount(0);
});
