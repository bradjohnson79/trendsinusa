import type { IngestionProvider } from '@prisma/client';
import { prisma } from '@trendsinusa/db';

export type ProviderCredentialsStatus = 'LOCKED' | 'READY';

export type ProviderRuntimeStatus = {
  provider: IngestionProvider;
  credentials: { status: ProviderCredentialsStatus; missing: string[] };
  enabled: boolean;
};

function requiredEnvFor(provider: IngestionProvider): string[] {
  switch (provider) {
    case 'AMAZON':
      return ['AMAZON_ACCESS_KEY', 'AMAZON_SECRET_KEY', 'AMAZON_ASSOCIATE_TAG'];
    case 'WALMART':
      return ['WALMART_API_KEY'];
    case 'TARGET':
      return ['TARGET_API_KEY'];
    case 'BEST_BUY':
      return ['BESTBUY_API_KEY'];
    default:
      return [];
  }
}

export function credentialsStatusFor(provider: IngestionProvider): { status: ProviderCredentialsStatus; missing: string[] } {
  const required = requiredEnvFor(provider);
  const missing = required.filter((k) => !process.env[k]);
  return { status: missing.length ? 'LOCKED' : 'READY', missing };
}

export async function providerRuntimeStatus(params: { siteKey: string; provider: IngestionProvider }): Promise<ProviderRuntimeStatus> {
  const cfg = await prisma.providerConfig
    .findUnique({ where: { siteKey_provider: { siteKey: params.siteKey, provider: params.provider } }, select: { enabled: true } })
    .catch(() => null);
  return {
    provider: params.provider,
    credentials: credentialsStatusFor(params.provider),
    enabled: Boolean(cfg?.enabled),
  };
}

export async function requireProviderEnabledAndReady(params: { siteKey: string; provider: IngestionProvider }) {
  const st = await providerRuntimeStatus(params);
  if (st.credentials.status !== 'READY') {
    throw new Error(`provider_locked:${params.provider}:missing_env=${st.credentials.missing.join(',')}`);
  }
  if (!st.enabled) {
    throw new Error(`provider_disabled:${params.provider}:admin_toggle_required`);
  }
}

