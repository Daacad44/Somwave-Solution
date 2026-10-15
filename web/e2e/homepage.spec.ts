import { expect, test } from '@playwright/test';

test('English homepage and accessible, pausable logo carousel', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Technology');

  const logos = page.getByRole('region', { name: 'Companies that trust Somwave' });
  await expect(logos.locator('ul').first().locator('img')).toHaveCount(6);
  await expect(logos.locator('ul').last()).toHaveAttribute('aria-hidden', 'true');
  await expect(logos.locator('ul').last().locator('img').first()).toHaveAttribute('alt', '');

  const track = logos.locator('.logo-track');
  await expect(track).toHaveCSS('animation-name', 'logo-scroll');
  const start = await track.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(150);
  const moved = await track.evaluate((element) => getComputedStyle(element).transform);
  expect(moved).not.toBe(start);
  await logos.locator('.logo-viewport').hover();
  await expect(track).toHaveCSS('animation-play-state', 'paused');
});

test('logo strip fits mobile and desktop; reduced motion shows one static set', async ({
  browser,
}) => {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');

    const logos = page.getByRole('region', { name: 'Companies that trust Somwave' });
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
