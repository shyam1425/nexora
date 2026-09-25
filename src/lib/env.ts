import { z } from 'zod';

/**
 * Central, validated environment configuration.
 *
 * Every module reads configuration through this module so that a missing or
 * malformed value fails fast and loudly instead of silently falling back to
 * localhost / hard-coded development values in production.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Optional CA certificate (PEM text or its base64 encoding) for managed MySQL
  // providers that sign with their own certificate authority, such as a default
  // Aiven service. Providers with a publicly-trusted certificate use `?ssl=true`
  // in DATABASE_URL and leave this unset.
  DATABASE_SSL_CA: z.string().optional(),

  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters long'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(12),

  APP_NAME: z.string().min(1).default('360 WorkFox Tech'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),

  // Whether the runtime sits behind exactly one trusted reverse proxy that
  // controls `x-forwarded-for` / `x-real-ip`. Defaults to false so that
  // client-supplied forwarding headers are never used as an identity; enable it
  // only when the documented proxy configuration is in place (DEPLOYMENT.md).
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().min(1).default('./storage/private'),
  STORAGE_MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_SESSION_TOKEN: z.string().optional(),
  // Path-style addressing: true for MinIO/self-hosted gateways, false for AWS.
  // Unset/empty (undefined) means "choose automatically": path-style when a
  // custom S3_ENDPOINT is configured, virtual-hosted otherwise.
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value.trim() === ''
        ? undefined
        : value === 'true' || value === '1',
    ),

  EMAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().default('no-reply@workfox.tech'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  DEFAULT_CURRENCY: z.string().length(3).default('INR'),
  PAYROLL_WORKING_DAYS: z.coerce.number().int().positive().max(31).default(22),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Next.js loads .env files automatically; process.env is the single source.
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        'Copy .env.example to .env and provide real values (see DEPLOYMENT.md).',
    );
  }

  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
