import { expect, test } from '@playwright/test';

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
