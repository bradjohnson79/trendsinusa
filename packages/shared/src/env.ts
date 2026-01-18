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
  SITE_URL: z.preprocess(emptyToUndefined, z.string().url().default('http://localhost:3005')),
  SITE_KEY: z.string().default('trendsinusa'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

function isBuildPhase(env: NodeJS.ProcessEnv): boolean {
  // Back-compat: some platforms set NEXT_PHASE=phase-production-build for build-time.
  return env.NEXT_PHASE === 'phase-production-build';
}

export function getBuildEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  // Build-time must not require runtime secrets (DB, AI, admin auth). We provide safe placeholders.
  const withFallback: NodeJS.ProcessEnv = { ...env };
  if (!withFallback.DATABASE_URL) {
    withFallback.DATABASE_URL = 'postgresql://user:pass@localhost:5432/postgres?schema=public';
  }
  const parsed = serverEnvSchema.safeParse(withFallback);
  if (!parsed.success) {
    throw new Error(`Invalid server environment variables:\n${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

export function getRuntimeEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment variables:\n${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

// Back-compat: most of the codebase calls `getServerEnv()`.
// During static build steps, we intentionally relax runtime-secret requirements.
export function getServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return isBuildPhase(env) ? getBuildEnv(env) : getRuntimeEnv(env);
}

export function getClientEnv(env: NodeJS.ProcessEnv = process.env): ClientEnv {
  // Build/runtime convenience: fall back to provider-specific vars, but return a stable shape.
  const withFallback: NodeJS.ProcessEnv = { ...env };
  // Back-compat: allow legacy public env var names to map into the new client env keys.
  if (!withFallback.SITE_URL && withFallback.NEXT_PUBLIC_SITE_URL) withFallback.SITE_URL = withFallback.NEXT_PUBLIC_SITE_URL;
  if (!withFallback.SITE_KEY && withFallback.NEXT_PUBLIC_SITE_KEY) withFallback.SITE_KEY = withFallback.NEXT_PUBLIC_SITE_KEY;
  if (!withFallback.APP_ENV && withFallback.NEXT_PUBLIC_APP_ENV) withFallback.APP_ENV = withFallback.NEXT_PUBLIC_APP_ENV;

  const vercelUrl = env.VERCEL_URL;
  if (!withFallback.SITE_URL && vercelUrl) withFallback.SITE_URL = `https://${vercelUrl}`;

  const parsed = clientEnvSchema.safeParse(withFallback);
  if (!parsed.success) {
    throw new Error(`Invalid client environment variables:\n${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

