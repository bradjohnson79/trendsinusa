import type { SiteConfig, SiteCountry } from '@sites/siteConfig';

import { config as usa } from '@sites/usa/config';
import { config as canada } from '@sites/canada/config';
import { config as uk } from '@sites/uk/config';
import { config as australia } from '@sites/australia/config';

const byCountry: Record<SiteCountry, SiteConfig> = {
  usa,
  canada,
  uk,
  australia,
};

function normalizeSiteCountry(input: unknown): SiteCountry | null {
  const v = String(input ?? '')
    .trim()
    .toLowerCase();
  if (v === 'usa' || v === 'us') return 'usa';
  if (v === 'canada' || v === 'ca') return 'canada';
  if (v === 'uk' || v === 'gb' || v === 'unitedkingdom') return 'uk';
  if (v === 'australia' || v === 'au') return 'australia';
  return null;
}

export function getSiteConfig(): SiteConfig {
  // No build-time validation. Default to USA if unset/unknown.
  const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SITE_COUNTRY;
  const key = normalizeSiteCountry(raw) ?? 'usa';
  return byCountry[key];
}

export const siteConfig = getSiteConfig();

