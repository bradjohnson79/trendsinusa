import 'server-only';

import { cache } from 'react';
import type { AffiliateProvider } from '@prisma/client';

import { prisma } from '@/src/server/prisma';
import { getCurrentSite } from '@/src/server/site';

const getAffiliateConfigUSCached = cache(async (siteKey: string) => {
  return await prisma.affiliateConfig.findUnique({ where: { siteKey_region: { siteKey, region: 'US' } } });
});

const getProviderConfigsCached = cache(async (siteKey: string) => {
  return await prisma.affiliateProviderConfig.findMany({
    where: { siteKey },
    orderBy: [{ priority: 'asc' }, { provider: 'asc' }],
  });
});

async function decideProvider(params: { asin: string }): Promise<
  | { ok: true; provider: AffiliateProvider; kind: 'affiliate' | 'merchant' }
  | { ok: false; reason: 'invalid_url' }
> {
  const [site, product] = await Promise.all([
    getCurrentSite(),
    prisma.product.findUnique({
      where: { asin: params.asin },
      include: { affiliateLinks: { where: { enabled: true } } },
    }),
  ]);
  const siteKey = site?.key ?? 'trendsinusa';
  const [amazon, providers] = await Promise.all([getAffiliateConfigUSCached(siteKey), getProviderConfigsCached(siteKey)]);

  // Build candidate list from product-level links first (if any), ordered by provider priority.
  const enabledProviders = providers.filter((p) => p.enabled);
  const siteOrder = site?.affiliatePriorities?.length ? site.affiliatePriorities : null;
  const siteRank = siteOrder
    ? new Map<AffiliateProvider, number>(siteOrder.map((p, i) => [p, i]))
    : null;
  const priorityByProvider = new Map<AffiliateProvider, number>(enabledProviders.map((p) => [p.provider, p.priority]));

  const productLinks = (product?.affiliateLinks ?? [])
    .map((l) => ({ provider: l.provider, url: l.url }))
    .sort((a, b) => {
      const ar = siteRank?.get(a.provider) ?? 999;
      const br = siteRank?.get(b.provider) ?? 999;
      if (ar !== br) return ar - br;
      return (priorityByProvider.get(a.provider) ?? 999) - (priorityByProvider.get(b.provider) ?? 999);
    });

  // Global injection toggle (per-site): if disabled, always route via "merchant" (clean URL).
  const globalEnabled = amazon?.enabled ?? false;
  if (!globalEnabled) {
    return { ok: true, provider: 'AMAZON', kind: 'merchant' };
  }

  for (const link of productLinks) {
    const cfg = enabledProviders.find((p) => p.provider === link.provider);
    if (!cfg) continue;
    try {
      // validate URL (clean, no hardcoded affiliate params)
      // eslint-disable-next-line no-new
      new URL(link.url);
      return { ok: true, provider: link.provider, kind: 'affiliate' };
    } catch {
      continue;
    }
  }

  // Fallback to Amazon (existing logic) if no other provider link available.
  return { ok: true, provider: 'AMAZON', kind: 'affiliate' };
}

export async function buildOutboundAmazonLink(params: {
  asin: string;
  section: string;
  ctaVariant: string;
  badgeVariant: string;
  dealStatus?: string;
  dealId?: string;
  partner?: string;
}) {
  // Default to the best available provider. Keep existing behavior: if no other provider is available,
  // this resolves to Amazon.
  const decision = await decideProvider({ asin: params.asin });

  // Build an internal redirect URL so we can log the click server-side before redirecting externally.
  const providerSegment = decision.ok ? (decision.kind === 'merchant' ? 'merchant' : decision.provider.toLowerCase()) : 'amazon';
  const internal = new URL(`/out/${encodeURIComponent(providerSegment)}/${encodeURIComponent(params.asin)}`, 'http://local');
  internal.searchParams.set('section', params.section);
  internal.searchParams.set('cta', params.ctaVariant);
  internal.searchParams.set('badge', params.badgeVariant);
  if (params.dealStatus) internal.searchParams.set('dealStatus', params.dealStatus);
  if (params.dealId) internal.searchParams.set('dealId', params.dealId);
  if (params.partner) internal.searchParams.set('partner', params.partner);

  if (!decision.ok) return { ok: false as const, reason: 'invalid_url' as const };
  return { ok: true as const, url: internal.pathname + internal.search };
}

