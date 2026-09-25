// Environment validation at boot (SYSTEM_PROMPT §13): parse with Zod, and on
// failure exit loudly naming the offending variable — without ever printing a
// value, so no secret leaks into logs.
import { z } from 'zod';
import { parseCorsOrigins } from './cors';

const envSchema = z
  .object({
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
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    SMTP_FROM: z.string().email().optional(),
    SMTP_NOTIFY_TO: z.string().email().optional(),
    PAYMENT_EVC_API_URL: z.string().url().optional(),
    PAYMENT_EVC_API_KEY: z.string().min(8).optional(),
    PAYMENT_EVC_MERCHANT_ID: z.string().min(1).optional(),
    PAYMENT_EVC_WEBHOOK_SECRET: z.string().min(16).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY: z.string().min(1).optional(),
    S3_SECRET_KEY: z.string().min(1).optional(),
    APP_PUBLIC_URL: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.SMTP_HOST) return;
    if (!value.SMTP_FROM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_FROM'],
        message: 'required when SMTP_HOST is set',
      });
    }
    const evcKeys = [
      'PAYMENT_EVC_API_URL',
      'PAYMENT_EVC_API_KEY',
      'PAYMENT_EVC_MERCHANT_ID',
      'PAYMENT_EVC_WEBHOOK_SECRET',
    ] as const;
    const set = evcKeys.filter((key) => value[key] !== undefined);
    if (set.length > 0 && set.length < evcKeys.length) {
      for (const key of evcKeys) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'required when any PAYMENT_EVC_* variable is set',
          });
        }
      }
    }
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
