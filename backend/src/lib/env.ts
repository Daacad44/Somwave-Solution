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
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    EMAIL_NOTIFY_TO: z.string().email().optional(),
    EMAIL_SUPPORT: z.string().email().optional(),
    PROJECT_INQUIRY_CODE_TTL_MINUTES: z.coerce.number().int().min(2).max(30).default(10),
    PAYMENT_EVC_API_URL: z.string().url().optional(),
    PAYMENT_EVC_API_KEY: z.string().min(8).optional(),
    PAYMENT_EVC_MERCHANT_ID: z.string().min(1).optional(),
    PAYMENT_EVC_WEBHOOK_SECRET: z.string().min(16).optional(),
    STORAGE_PROVIDER: z.enum(['s3', 'filesystem']).optional(),
    STORAGE_LOCAL_PATH: z.string().startsWith('/').optional(),
    S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY: z.string().min(1).optional(),
    S3_SECRET_KEY: z.string().min(1).optional(),
    // ImageKit stores every uploaded image. The private key is server-only; the
    // public key is accepted for completeness but the server SDK does not need it.
    IMAGEKIT_PRIVATE_KEY: z.string().min(1).optional(),
    IMAGEKIT_PUBLIC_KEY: z.string().min(1).optional(),
    IMAGEKIT_URL_ENDPOINT: z
      .string()
      .url()
      .refine((value) => value.startsWith('https://'), 'must be an https:// URL')
      .optional(),
    APP_PUBLIC_URL: z.string().url().optional(),
    HEALTH_PROBE_HOSTS: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const sender = value.EMAIL_FROM?.trim();
    const senderEmail = sender?.match(/^[^<>\r\n]+ <([^<>\s]+)>$/)?.[1] ?? sender;
    if (sender && !z.string().email().safeParse(senderEmail).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_FROM'],
        message: 'must be an email address or a display name followed by <email address>',
      });
    }
    if (Boolean(value.IMAGEKIT_PRIVATE_KEY) !== Boolean(value.IMAGEKIT_URL_ENDPOINT)) {
      for (const key of ['IMAGEKIT_PRIVATE_KEY', 'IMAGEKIT_URL_ENDPOINT'] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'required when the other IMAGEKIT_* variable is set',
          });
        }
      }
    }
    if (value.IMAGEKIT_PUBLIC_KEY?.startsWith('private_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['IMAGEKIT_PUBLIC_KEY'],
        message: 'looks like a private key; put the private key in IMAGEKIT_PRIVATE_KEY only',
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
