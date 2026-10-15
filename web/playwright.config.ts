import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4731',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command:
      'ASTRO_TELEMETRY_DISABLED=1 PUBLIC_API_URL=http://127.0.0.1:1/api/v1 npm run dev -- --host 127.0.0.1 --port 4731 --strictPort',
    url: 'http://127.0.0.1:4731',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
