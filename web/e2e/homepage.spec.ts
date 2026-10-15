import { expect, test } from '@playwright/test';

test('English homepage and accessible, pausable logo carousel', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#hero-heading')).toContainText('Technology');

  const logos = page.getByRole('region', { name: 'Trusted by leading businesses in Somalia' });
  await expect(logos.locator('ul').first().locator('img')).toHaveCount(6);
  await expect(logos.locator('ul').last()).toHaveAttribute('aria-hidden', 'true');
  await expect(logos.locator('ul').last().locator('img').first()).toHaveAttribute('alt', '');

  const track = logos.locator('.logo-track');
  await logos.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(track).toHaveCSS('animation-name', 'logo-scroll');
  await expect(track).toHaveCSS('animation-play-state', 'running');
  const start = await track.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(150);
  const moved = await track.evaluate((element) => getComputedStyle(element).transform);
  expect(moved).not.toBe(start);
  await logos.locator('.logo-viewport').hover();
  await expect(track).toHaveCSS('animation-play-state', 'paused');
  await page.mouse.move(0, 0);
  await logos.getByRole('button', { name: 'Pause logo carousel' }).click();
  await expect(track).toHaveCSS('animation-play-state', 'paused');
  await logos.getByRole('button', { name: 'Resume logo carousel' }).click();
});

test('logo strip fits mobile and desktop; reduced motion shows one static set', async ({
  browser,
}) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');

    const logos = page.getByRole('region', { name: 'Trusted by leading businesses in Somalia' });
    await expect(logos.locator('.logo-track')).toHaveCSS('animation-name', 'none');
    await expect(logos.locator('ul').last()).toBeHidden();
    const rows = await logos
      .locator('ul')
      .first()
      .locator('li')
      .evaluateAll(
        (items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size,
      );
    expect(rows).toBe(width < 640 ? 3 : width < 1024 ? 2 : 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await context.close();
  }
});

test('homepage sections, navigation and contact actions are functional', async ({ page }) => {
  await page.goto('/');
  const headings = await page.locator('main h2').allTextContents();
  const ordered = [
    'Trusted by leading businesses in Somalia',
    'Comprehensive IT Solutions for Your Business',
    'All-in-One Digital Solutions',
    'Featured Projects',
    'Your Technology Partner for Success',
    'Latest Articles & Resources',
    'Frequently Asked Questions',
    'Ready to Transform',
  ];
  expect(headings.join('|')).toContain(ordered[0]);
  for (let index = 1; index < ordered.length; index += 1) {
    expect(headings.findIndex((value) => value.includes(ordered[index]!))).toBeGreaterThan(
      headings.findIndex((value) => value.includes(ordered[index - 1]!)),
    );
  }
  await page.getByRole('link', { name: 'Get Started' }).first().click();
  await expect(page).toHaveURL(/\/nala-soo-xiriir$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('contact form validates before sending and reports a successful submission', async ({
  page,
}) => {
  await page.goto('/nala-soo-xiriir');
  const form = page.locator('#inquiry-form');
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(form.getByRole('status')).toHaveText('Name is required');
  await expect(form.locator('[name="name"]')).toHaveAttribute('aria-invalid', 'true');

  await form.locator('[name="name"]').fill('Test Visitor');
  await form.locator('[name="email"]').fill('test@example.com');
  await form.locator('[name="message"]').fill('I would like to discuss a website project.');
  await page.route('**/api/v1/public/inquiries', (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 201,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': 'http://127.0.0.1:4731',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, idempotency-key',
      },
      body:
        route.request().method() === 'OPTIONS'
          ? ''
          : JSON.stringify({ data: { id: 'test-inquiry' } }),
    }),
  );
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(form.getByRole('status')).toContainText('Thank you');
});
