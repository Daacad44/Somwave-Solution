import { expect, test } from '@playwright/test';

test('project dashboard and management tabs work on desktop and mobile', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByText('Total projects')).toBeVisible();
  await expect(page.getByLabel('Search projects')).toBeVisible();
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  const projectLink = page.locator('article a[href^="/projects/"]').first();
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  await expect(page.getByRole('navigation', { name: 'Project sections' })).toBeVisible();

  await page.getByRole('button', { name: 'Team & Engineers' }).click();
  await expect(page.getByRole('heading', { name: 'Project team' })).toBeVisible();
  if (await page.getByRole('heading', { name: 'Assign engineer' }).count()) {
    await expect(page.getByRole('button', { name: 'Invite engineer' })).toBeVisible();
  } else {
    await expect(page.getByRole('button', { name: 'Invite engineer' })).toHaveCount(0);
  }

  await page.getByRole('button', { name: 'Timeline & Calendar' }).click();
  await expect(page.getByRole('heading', { name: 'Project timeline' }).first()).toBeVisible();
  await expect(page.getByLabel('Project deadline calendar')).toBeVisible();

  await page.getByRole('button', { name: 'Activity & Audit Logs' }).click();
  await expect(page.getByRole('heading', { name: 'Project activity' })).toBeVisible();
});
