import { execSync } from 'node:child_process';

function hasRequiredDbEnv() {
  return Boolean(process.env.DATABASE_URL) && Boolean(process.env.DATABASE_DIRECT_URL);
}

try {
  // In CI/Vercel, we rely on env vars (no committed .env files). Generate Prisma Client so schema changes are reflected.
  if (process.env.VERCEL || process.env.CI) {
    if (!hasRequiredDbEnv()) {
      console.warn('[postinstall] Skipping prisma generate (missing DATABASE_URL / DATABASE_DIRECT_URL).');
    } else {
      console.log('[postinstall] Running prisma generate for @trendsinusa/db...');
      execSync('pnpm --filter @trendsinusa/db prisma:generate', { stdio: 'inherit' });
    }
  }
} catch (e) {
  console.warn('[postinstall] Prisma generate failed; continuing install.', e?.message ?? e);
}

