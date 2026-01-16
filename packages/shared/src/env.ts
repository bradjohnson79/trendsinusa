import { z } from 'zod';

function formatZodError(e: z.ZodError): string {
  const flat = e.flatten();
  const lines = Object.entries(flat.fieldErrors).flatMap(([k, v]) =>
    (v ?? []).map((msg) => `${k}: ${msg}`),
  );
  const formErrors = flat.formErrors.map((msg) => `env: ${msg}`);
  return [...lines, ...formErrors].join('\n');
}

function emptyToUndefined(v: unknown): unknown {
  return typeof v === 'string' && v.trim() === '' ? undefined : v;
}

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Multi-site
  SITE_KEY: z.preprocess(emptyToUndefined, z.string().default('trendsinusa')),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_DIRECT_URL: z.preprocess(emptyToUndefined, z.string().optional()),

  // Admin (web middleware)
  ADMIN_BASIC_AUTH_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  ADMIN_BASIC_AUTH_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  ADMIN_SESSION_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),

  // Worker
  WORKER_LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // Future AI/automation placeholders
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

  // Amazon Product Advertising API (PA API)
  AMAZON_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AMAZON_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AMAZON_ASSOCIATE_TAG: z.preprocess(emptyToUndefined, z.string().optional()),

  // Automation & AI control plane (feature flags, not constants)
  PERPLEXITY_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AI_RESEARCH_MODEL: z.preprocess(emptyToUndefined, z.string().default('sonar')),
  AI_FINAL_MODEL: z.preprocess(emptyToUndefined, z.string().default('gpt-4.1')),
  AI_MIN_CONFIDENCE: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(1).default(0.6)),
  AI_AUTO_REGENERATE_DAYS: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(365).default(14)),

  // Ecosystem billing (preview-only unless explicitly activated)
  ECOSYSTEM_BILLING_MODE: z.enum(['off', 'preview', 'active']).default('off'),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SITE_KEY: z.string().default('trendsinusa'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function getServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment variables:\n${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

export function getClientEnv(env: NodeJS.ProcessEnv = process.env): ClientEnv {
  const parsed = clientEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid client environment variables:\n${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

