import 'server-only';

import { getServerEnv, readSitesConfig } from '@trendsinusa/shared';
import { cache } from 'react';
import { headers } from 'next/headers';

const readSitesConfigCached = cache(async () => {
  return await readSitesConfig();
});

function stripPort(host: string): string {
  const h = host.trim().toLowerCase();
  const idx = h.indexOf(':');
  return idx === -1 ? h : h.slice(0, idx);
}

function resolveSiteKeyForHost(host: string, sites: Array<{ key: string; domain: string; enabled: boolean }>): string | null {
  const h = stripPort(host);
  // Choose the most specific (longest) matching domain.
  const candidates = sites
    .filter((s) => s.enabled)
    .filter((s) => {
      const d = s.domain.toLowerCase();
      return h === d || h.endsWith(`.${d}`);
    })
    .sort((a, b) => b.domain.length - a.domain.length);
  return candidates[0]?.key ?? null;
}

export function getCurrentSiteKey(): string {
  // Default site selection for non-request contexts.
  const env = getServerEnv();
  return env.SITE_KEY;
}

export function siteTag(key: string): string {
  return `site:${key}`;
}

export async function getCurrentSite() {
  const key = await getResolvedSiteKey();
  const { config } = await readSitesConfigCached();
  return config.sites.find((s) => s.key === key) ?? null;
}

export async function getResolvedSiteKey(): Promise<string> {
  // White-label readiness: resolve site by Host header when available.
  // Fallback to env SITE_KEY for local/dev or when Host doesn't match.
  const envKey = getCurrentSiteKey();
  try {
    const h = await headers();
    const host = h.get('host');
    if (!host) return envKey;
    const { config } = await readSitesConfigCached();
    return resolveSiteKeyForHost(host, config.sites) ?? envKey;
  } catch {
    return envKey;
  }
}

export async function getResolvedSiteKeyForHost(host: string): Promise<string> {
  const envKey = getCurrentSiteKey();
  const { config } = await readSitesConfigCached();
  return resolveSiteKeyForHost(host, config.sites) ?? envKey;
}

