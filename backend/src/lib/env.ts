// Environment validation at boot (SYSTEM_PROMPT §13): parse with Zod, and on
// failure exit loudly naming the offending variable — without ever printing a
// value, so no secret leaks into logs.
import { z } from 'zod';
import { parseCorsOrigins } from './cors';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  // Coolify Redis is password-protected. The URL is often host-only
  // (`redis://uuid:6379`); AUTH then comes from this sibling var.
  REDIS_PASSWORD: z.string().optional(),
  REDIS_USERNAME: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  CORS_ORIGINS: z.string().min(1, 'comma-separated list of allowed origins is required'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // Names and messages only — never the values (§13).
    console.error(`\n[env] Invalid or missing environment variables:\n${details}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

// CORS is locked to an explicit allow-list, never "*" (§13).
export const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);
