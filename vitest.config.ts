import { defineConfig } from 'vitest/config';

// Monorepo test config (Vitest). Backend + shared run in a Node environment.
// Dummy env satisfies the boot-time env validation in backend/src/lib/env.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/**/*.test.ts', 'packages/shared/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://somwave:somwave@localhost:5432/somwave',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: '0123456789012345678901234567890123',
      CORS_ORIGINS: 'http://localhost:5173',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['backend/src/**', 'packages/shared/src/**'],
    },
  },
});
