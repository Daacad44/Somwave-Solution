import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

for (const module of ['team', 'testimonials'] as const) {
  test(`${module} validates images and refuses to save after server upload failure`, async ({
    page,
  }) => {
    let uploads = 0;
    let saves = 0;
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/cms/article-images')) {
        uploads++;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'INTERNAL_ERROR', message: 'File storage is unavailable' },
          }),
        });
        return;
      }
      if (path.endsWith(`/cms/${module}`) && route.request().method() === 'POST') saves++;
      const data = path.endsWith('/auth/me')
        ? {
            user: {
              id: 'storage-tester',
              email: 'storage@example.test',
              name: 'Storage tester',
              roles: ['SUPER_ADMIN'],
              permissions: [],
              clientId: null,
              twoFactorEnabled: true,
              twoFactorRequired: false,
            },
          }
        : [];
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
    });
    await page.goto(`/cms/${module}`);
    const title = module === 'team' ? 'New team member' : 'New testimonial';
    await page.getByRole('button', { name: title, exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: title });
    if (module === 'team') {
      await dialog.getByLabel('Name', { exact: true }).fill('Storage test');
      await dialog.getByLabel('Role', { exact: true }).fill('Engineer');
    } else {
      await dialog.getByLabel('Author', { exact: true }).fill('Storage test');
      await dialog.getByLabel('Testimonial', { exact: true }).fill('Verified browser fixture');
    }
    const fileInput = dialog.locator('input[type=file]');
    await fileInput.setInputFiles({
      name: 'unsafe.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    });
    await expect(
      dialog.getByText('Upload a JPG, PNG, or WebP image.', { exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    expect(uploads).toBe(0);
    expect(saves).toBe(0);
    await fileInput.setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJH0AAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(dialog.getByRole('button', { name: 'Replace image' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog.getByText('File storage is unavailable', { exact: true })).toBeVisible();
    expect(uploads).toBe(1);
    expect(saves).toBe(0);
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });
}
