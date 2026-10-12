import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    browserName: 'chromium',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'test-results/.auth/user.json' },
    },
    {
      name: 'mobile',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        storageState: 'test-results/.auth/user.json',
      },
    },
  ],
});
