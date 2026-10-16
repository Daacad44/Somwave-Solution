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
  const widths = await track.evaluate((element) => {
    const [first, second] = element.querySelectorAll('ul');
    return {
      first: first!.getBoundingClientRect().width,
      second: second!.getBoundingClientRect().width,
      track: element.getBoundingClientRect().width,
    };
  });
  expect(Math.abs(widths.first - widths.second)).toBeLessThan(1);
  expect(Math.abs(widths.track - widths.first * 2)).toBeLessThan(1);
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
    'All-in-One Digital Solutions',
    'Comprehensive IT Solutions for Your Business',
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

test('hero slider supports manual, keyboard, autoplay, hover pause and reduced motion', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  const hero = page.locator('.hero-slider');
  const active = hero.locator('.hero-slide.is-active');
  await expect(active).toContainText('Innovative Technology Solutions');
  await hero.getByRole('button', { name: 'Next slide' }).click();
  await expect(active).toContainText('Power Your Business');
  await expect(hero.locator('.hero-slide').first()).toHaveAttribute('aria-hidden', 'true');
  await hero.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(active).toContainText('Innovative Technology Solutions');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(0, 0);
  await page.clock.fastForward(7100);
  await expect(active).toContainText('Power Your Business');
  await hero.hover();
  await page.clock.fastForward(8000);
  await expect(active).toContainText('Power Your Business');
  await page.mouse.move(0, 0);
  await page.clock.fastForward(7100);
  await expect(active).toContainText('Everything Your Business Needs');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(hero).not.toHaveClass(/is-playing/);
  await page.clock.fastForward(8000);
  await expect(active).toContainText('Everything Your Business Needs');
});

test('ecosystem keeps all eight linked cards and reverses its desktop scroll story', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const solution = page.locator('#solutions');
  await expect(solution.locator('.solution-card')).toHaveCount(8);
  await expect(solution.locator('.solution-hub img')).toHaveAttribute('alt', 'Somwave Solution');
  await solution.scrollIntoViewIfNeeded();
  await page.evaluate(() =>
    document.querySelector('#solutions')?.scrollIntoView({ block: 'start', behavior: 'instant' }),
  );
  await expect(solution).toHaveAttribute('data-story-stage', 'intro');
  await page.evaluate(() => {
    const section = document.querySelector('#solutions')!;
    window.scrollTo(0, window.scrollY + section.getBoundingClientRect().height * 0.88);
  });
  await expect(solution).toHaveAttribute('data-story-stage', 'complete');
  await page.evaluate(() =>
    document.querySelector('#solutions')?.scrollIntoView({ block: 'start', behavior: 'instant' }),
  );
  await expect(solution).toHaveAttribute('data-story-stage', 'intro');
});

test('mobile swipe changes slides and solution cards remain navigable without motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const hero = page.locator('.hero-slider');
  await hero.evaluate((element) => {
    const start = new Touch({ identifier: 1, target: element, clientX: 320, clientY: 260 });
    const end = new Touch({ identifier: 1, target: element, clientX: 80, clientY: 260 });
    element.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [start], bubbles: true }));
    element.dispatchEvent(new TouchEvent('touchend', { changedTouches: [end], bubbles: true }));
  });
  await expect(hero.locator('.hero-slide.is-active')).toContainText('Power Your Business');
  const solution = page.locator('#solutions');
  await expect(solution).not.toHaveClass(/has-story/);
  await expect(solution.locator('.solution-card')).toHaveCount(8);
  await expect(solution.locator('.solution-card').first()).toHaveAttribute('href', '/adeegyada');
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

test('project request verifies email and creates a portal account', async ({ page }) => {
  await page.route('**/api/v1/public/project-inquiries**', (route) => {
    const url = route.request().url();
    const data = url.endsWith('/verify')
      ? { status: 'EMAIL_VERIFIED', accountExists: false, activationToken: 'test-activation-proof' }
      : url.endsWith('/activate')
        ? { status: 'ACCOUNT_CREATED', loginUrl: '/login' }
        : { id: 'inquiry-1', status: 'PENDING_VERIFICATION', verificationRequired: true };
    return route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 201,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': 'http://127.0.0.1:4731',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, idempotency-key',
      },
      body: route.request().method() === 'OPTIONS' ? '' : JSON.stringify({ data }),
    });
  });
  await page.goto('/request-project');
  const request = page.locator('#project-inquiry-form');
  await request.locator('[name="name"]').fill('Test Client');
  await request.locator('[name="email"]').fill('client@example.com');
  await request.locator('[name="projectType"]').fill('Website');
  await request.locator('[name="description"]').fill('I need a website for my business.');
  await request.getByRole('button', { name: 'Send project request' }).click();
  const verify = page.locator('#verify-inquiry-form');
  await expect(verify).toBeVisible();
  await verify.locator('[name="code"]').fill('123456');
  await verify.getByRole('button', { name: 'Verify email' }).click();
  const activate = page.locator('#activate-inquiry-form');
  await expect(activate).toBeVisible();
  await activate.locator('[name="password"]').fill('A-long-password-123');
  await expect(activate.locator('#password-strength')).toContainText('Strong');
  await activate.getByRole('button', { name: 'Show password' }).click();
  await expect(activate.locator('[name="password"]')).toHaveAttribute('type', 'text');
  await activate.getByRole('button', { name: 'Hide password' }).click();
  await activate.locator('[name="confirmPassword"]').fill('A-long-password-123');
  await activate.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#request-complete')).toContainText('Your request is verified');
  await expect(page.locator('#request-complete a')).toHaveAttribute(
    'href',
    'https://app.somwave.botandev.com/login?next=%2Fportal%2Fprojects',
  );
});
