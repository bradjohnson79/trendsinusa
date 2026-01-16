import 'server-only';

import { prisma } from '@/src/server/prisma';

type Meta = {
  event: string;
  section: string;
  dealStatus: string;
  cta: string;
  badge: string;
  provider: string;
  site: string;
};

function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    section: sp.get('section') ?? 'unknown',
    dealStatus: sp.get('dealStatus') ?? 'unknown',
    cta: sp.get('cta') ?? 'unknown',
    badge: sp.get('badge') ?? 'unknown',
    provider: (sp.get('provider') ?? 'amazon').toLowerCase(),
    site: sp.get('site') ?? 'unknown',
  };
}

// Same conservative EPC assumptions as /admin/revenue (cents per outbound click).
const EPC_CENTS: Record<string, number> = {
  amazon: 12,
  walmart: 10,
  target: 10,
};

function epcCents(provider: string): number {
  return EPC_CENTS[provider] ?? 0;
}

function priceBand(cents: number): 'under_25' | '25_50' | '50_100' | '100_plus' {
  if (cents < 2500) return 'under_25';
  if (cents < 5000) return '25_50';
  if (cents < 10000) return '50_100';
  return '100_plus';
}

function expiryBucket(hours: number): 'lte_1h' | 'lte_6h' | 'lte_24h' | 'gt_24h' {
  if (hours <= 1) return 'lte_1h';
  if (hours <= 6) return 'lte_6h';
  if (hours <= 24) return 'lte_24h';
  return 'gt_24h';
}

export async function getCrossSiteIntel(params: { days: number }) {
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);

  // Pull a bounded window of events. This is intentionally simple/auditable.
  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { occurredAt: true, href: true, referrer: true, dealId: true },
    take: 50000,
    orderBy: { occurredAt: 'desc' },
  });

  const dealIds = Array.from(new Set(events.map((e) => e.dealId).filter(Boolean))) as string[];
  const deals = dealIds.length
    ? await prisma.deal.findMany({
        where: { id: { in: dealIds } },
        select: {
          id: true,
          expiresAt: true,
          currentPriceCents: true,
          product: { select: { category: true, categoryOverride: true } },
        },
      })
    : [];
  const dealById = new Map(deals.map((d) => [d.id, d] as const));

  const sites = new Set<string>();

  const impressionsBySite = new Map<string, number>();
  const clicksBySite = new Map<string, number>();

  const providerClicksBySite = new Map<string, Map<string, number>>();
  const providerRevBySite = new Map<string, Map<string, number>>();

  const revenueByCategory = new Map<string, number>();
  const revenueByCategoryBySite = new Map<string, Map<string, number>>();

  const clicksByPriceBand = new Map<string, number>();
  const revenueByPriceBand = new Map<string, number>();

  const clicksByExpiryBucket = new Map<string, number>();
  const revenueByExpiryBucket = new Map<string, number>();

  const clicksByCta = new Map<string, number>();
  const clicksByBadge = new Map<string, number>();

  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    sites.add(meta.site);

    const isImpression = e.href === 'event://impression';
    const isClick = meta.event === 'affiliate_click';

    if (isImpression) {
      impressionsBySite.set(meta.site, (impressionsBySite.get(meta.site) ?? 0) + 1);
      continue;
    }

    if (!isClick) continue;

    const epc = epcCents(meta.provider);
    clicksBySite.set(meta.site, (clicksBySite.get(meta.site) ?? 0) + 1);

    const pc = providerClicksBySite.get(meta.site) ?? new Map<string, number>();
    pc.set(meta.provider, (pc.get(meta.provider) ?? 0) + 1);
    providerClicksBySite.set(meta.site, pc);

    const pr = providerRevBySite.get(meta.site) ?? new Map<string, number>();
    pr.set(meta.provider, (pr.get(meta.provider) ?? 0) + epc);
    providerRevBySite.set(meta.site, pr);

    clicksByCta.set(meta.cta, (clicksByCta.get(meta.cta) ?? 0) + 1);
    clicksByBadge.set(meta.badge, (clicksByBadge.get(meta.badge) ?? 0) + 1);

    const dealId = e.dealId ?? null;
    if (!dealId) continue;
    const d = dealById.get(dealId);
    if (!d) continue;

    const category = d.product.categoryOverride ?? d.product.category ?? 'unknown';
    revenueByCategory.set(category, (revenueByCategory.get(category) ?? 0) + epc);
    const bySite = revenueByCategoryBySite.get(category) ?? new Map<string, number>();
    bySite.set(meta.site, (bySite.get(meta.site) ?? 0) + epc);
    revenueByCategoryBySite.set(category, bySite);

    const band = priceBand(d.currentPriceCents);
    clicksByPriceBand.set(band, (clicksByPriceBand.get(band) ?? 0) + 1);
    revenueByPriceBand.set(band, (revenueByPriceBand.get(band) ?? 0) + epc);

    const hours = (d.expiresAt.getTime() - e.occurredAt.getTime()) / (60 * 60 * 1000);
    const bucket = expiryBucket(hours);
    clicksByExpiryBucket.set(bucket, (clicksByExpiryBucket.get(bucket) ?? 0) + 1);
    revenueByExpiryBucket.set(bucket, (revenueByExpiryBucket.get(bucket) ?? 0) + epc);
  }

  function ctr(clicks: number, imps: number) {
    if (imps <= 0) return 0;
    return clicks / imps;
  }

  const sitesList = Array.from(sites).sort((a, b) => a.localeCompare(b));
  const bySite = sitesList.map((site) => {
    const imps = impressionsBySite.get(site) ?? 0;
    const clicks = clicksBySite.get(site) ?? 0;

    const providers = Array.from((providerClicksBySite.get(site) ?? new Map()).entries())
      .map(([provider, clicks]) => ({
        provider,
        clicks,
        estRevenueCents: (providerRevBySite.get(site)?.get(provider) ?? 0),
      }))
      .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

    return { site, impressions: imps, clicks, ctr: ctr(clicks, imps), providers };
  });

  const topCategories = Array.from(revenueByCategory.entries())
    .map(([category, estRevenueCents]) => ({
      category,
      estRevenueCents,
      bySite: Object.fromEntries((revenueByCategoryBySite.get(category) ?? new Map()).entries()),
    }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents)
    .slice(0, 25);

  const priceBands = Array.from(new Set([...clicksByPriceBand.keys(), ...revenueByPriceBand.keys()]));
  const byPriceBand = priceBands
    .map((band) => ({
      band,
      clicks: clicksByPriceBand.get(band) ?? 0,
      estRevenueCents: revenueByPriceBand.get(band) ?? 0,
    }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  const expiryBuckets = Array.from(new Set([...clicksByExpiryBucket.keys(), ...revenueByExpiryBucket.keys()]));
  const byTimeToExpiry = expiryBuckets
    .map((bucket) => ({
      bucket,
      clicks: clicksByExpiryBucket.get(bucket) ?? 0,
      estRevenueCents: revenueByExpiryBucket.get(bucket) ?? 0,
    }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  const topCtas = Array.from(clicksByCta.entries())
    .map(([cta, clicks]) => ({ cta, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  const topBadges = Array.from(clicksByBadge.entries())
    .map(([badge, clicks]) => ({ badge, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  // Recommendations (insights-only)
  const recommendedCategoriesForNewSites = topCategories.slice(0, 10).map((c) => c.category);
  const recommendedPriceBands = byPriceBand.slice(0, 3).map((b) => b.band);
  const providerStrategy = bySite
    .flatMap((s) => s.providers.map((p) => ({ site: s.site, ...p })))
    .reduce(
      (acc, row) => {
        acc.set(row.provider, (acc.get(row.provider) ?? 0) + row.estRevenueCents);
        return acc;
      },
      new Map<string, number>(),
    );
  const providerWinners = Array.from(providerStrategy.entries())
    .map(([provider, estRevenueCents]) => ({ provider, estRevenueCents, epcCents: epcCents(provider) }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  return {
    since,
    assumptions: { epcCentsByProvider: EPC_CENTS },
    bySite,
    topCategories,
    byPriceBand,
    byTimeToExpiry,
    copy: { topCtas, topBadges },
    recommendations: {
      categoryFocusForNewSites: recommendedCategoriesForNewSites,
      priceBandsToEmphasize: recommendedPriceBands,
      providerWinners,
      notes: [
        'All revenue is estimated via static EPC assumptions per provider (cents per outbound click).',
        'Time-to-expiry uses click timestamp vs deal.expiresAt. Impressions are not currently time-bucketed.',
        '“Copy patterns” are derived from tracked CTA + badge variants (not from AI hero/deal copy text).',
      ],
    },
  };
}

