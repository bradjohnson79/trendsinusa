import 'server-only';

import type { AffiliateProvider } from '@prisma/client';

export type ProviderDecision =
  | { ok: true; provider: AffiliateProvider; url: string }
  | { ok: false; reason: 'disabled' | 'missing_affiliate_id' | 'invalid_url' };

export function buildAmazonUrl(asin: string): string {
  return `https://www.amazon.com/dp/${encodeURIComponent(asin)}`;
}

export function applyAmazonTag(url: string, associateTag: string): string {
  const u = new URL(url);
  u.searchParams.set('tag', associateTag);
  return u.toString();
}

export function applyTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => params[k] ?? '');
}

