import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/auth/me'))
      data = {
        user: {
          id: 'finance-fixture',
          email: 'finance@example.test',
          name: 'Finance tester',
          roles: ['SUPER_ADMIN'],
          permissions: [],
          clientId: null,
          twoFactorEnabled: true,
          twoFactorRequired: true,
        },
      };
    else if (path.endsWith('/finance/link-options')) data = { projects: [], clients: [] };
    else if (path.endsWith('/finance/dashboard'))
      data = {
        from: '2026-09-30T21:00:00Z',
        to: '2026-10-31T21:00:00Z',
        basis: 'Posted finance journals only',
        timezone: 'Africa/Mogadishu',
        currencies: [],
        trends: [],
        pendingApprovals: 0,
        accountBalances: [],
        limitations: ['Payroll is not implemented.'],
      };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data, meta: { page: 1, pageSize: 20, total: 0 } }),
    });
  });
});

test('finance handles empty data and invalid ranges on desktop and mobile', async ({ page }) => {
  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Financial Management' })).toBeVisible();
  await expect(page.getByText('No posted journals in this period')).toBeVisible();
  await expect(page.getByText('Pending approvals in period: 0')).toBeVisible();
  await expect(page.getByText(/Date filters use Africa\/Mogadishu/)).toBeVisible();
  await page.getByLabel('From (inclusive)').fill('2026-10-01');
  await page.getByLabel('To (exclusive)').fill('2026-10-01');
  await expect(page.getByText('Select an end date after the start date.')).toBeVisible();
  await expect(page.getByText('Could not load finance dashboard.')).toHaveCount(0);
  await expect(page.getByText('No posted journals in this period')).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test('finance exposes actionable MFA failure and supports retry', async ({ page }) => {
  let allowed = false;
  await page.route('**/api/v1/finance/dashboard?**', async (route) => {
    if (!allowed)
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'FORBIDDEN',
            message: 'Sign out and sign in with your two-factor code before accessing finance',
          },
        }),
      });
    else
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            basis: 'Posted journals',
            currencies: [],
            trends: [],
            pendingApprovals: 0,
            accountBalances: [],
            limitations: [],
          },
        }),
      });
  });
  await page.goto('/finance');
  await expect(
    page.getByText('Sign out and sign in with your two-factor code before accessing finance'),
  ).toBeVisible({ timeout: 15000 });
  allowed = true;
  await page.getByRole('button', { name: /try again|retry/i }).click();
  await expect(page.getByText('No posted journals in this period')).toBeVisible();
});

test('finance renders and edits the same Mogadishu transaction date', async ({ page }) => {
  await page.route('**/api/v1/finance/transactions?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'draft-date',
            type: 'INCOME',
            status: 'DRAFT',
            amount: '12.34',
            currency: 'USD',
            category: 'Service',
            description: 'Timezone regression',
            occurredOn: '2026-09-30T21:00:00.000Z',
            cashAccountId: 'cash',
            offsetAccountId: 'revenue',
            createdById: 'finance-fixture',
            reviewedById: null,
            reviewReason: null,
            postedJournalId: null,
            createdAt: '2026-09-30T21:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      }),
    });
  });
  await page.goto('/finance');
  await page.getByRole('button', { name: 'Transactions', exact: true }).click();
  await expect(page.getByText('2026-10-01 · DRAFT')).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Accounting date', { exact: true })).toHaveValue('2026-10-01');
});
