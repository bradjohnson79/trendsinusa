import 'server-only';

import type { AffiliateProvider, PlacementType } from '@prisma/client';
import { prisma } from '@/src/server/prisma';

type Meta = {
  event: string;
  section: string;
  dealStatus: string;
  provider: string;
};

function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    section: sp.get('section') ?? 'unknown',
    dealStatus: sp.get('dealStatus') ?? 'unknown',
    provider: (sp.get('provider') ?? 'amazon').toLowerCase(),
  };
}

// Conservative EPC assumptions (cents per outbound click). Keep internal + auditable.
const EPC_CENTS: Record<string, number> = {
  amazon: 12,
  walmart: 10,
  target: 10,
};

function epcCents(provider: string): number {
  return EPC_CENTS[provider] ?? 0;
}

function activePlacementTypes(now: Date, placements: Array<{ type: PlacementType; enabled: boolean; startsAt: Date; endsAt: Date }>) {
  return placements
    .filter((p) => p.enabled && p.startsAt <= now && p.endsAt > now)
    .map((p) => p.type);
}

export async function getRevenueIntel(params: { days: number }) {
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);

  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { href: true, referrer: true, dealId: true },
    take: 50000,
    orderBy: { occurredAt: 'desc' },
  });

  const providerClicks = new Map<string, number>();
  const providerRevenue = new Map<string, number>();
  const sectionClicks = new Map<string, number>();
  const sectionRevenue = new Map<string, number>();

  const dealImpressions = new Map<string, number>();
  const dealClicks = new Map<string, number>();
  const dealRevenue = new Map<string, number>();
  const dealProviders = new Map<string, Map<string, number>>();

  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    const dealId = e.dealId ?? null;

    if (e.href === 'event://impression') {
      if (dealId) dealImpressions.set(dealId, (dealImpressions.get(dealId) ?? 0) + 1);
      continue;
    }

    if (meta.event !== 'affiliate_click') continue;

    const provider = meta.provider;
    const epc = epcCents(provider);

    providerClicks.set(provider, (providerClicks.get(provider) ?? 0) + 1);
    providerRevenue.set(provider, (providerRevenue.get(provider) ?? 0) + epc);

    sectionClicks.set(meta.section, (sectionClicks.get(meta.section) ?? 0) + 1);
    sectionRevenue.set(meta.section, (sectionRevenue.get(meta.section) ?? 0) + epc);

    if (dealId) {
      dealClicks.set(dealId, (dealClicks.get(dealId) ?? 0) + 1);
      dealRevenue.set(dealId, (dealRevenue.get(dealId) ?? 0) + epc);

      const mp = dealProviders.get(dealId) ?? new Map<string, number>();
      mp.set(provider, (mp.get(provider) ?? 0) + 1);
      dealProviders.set(dealId, mp);
    }
  }

  const providerPerformance = Array.from(providerClicks.entries())
    .map(([provider, clicks]) => ({
      provider,
      clicks,
      epcCents: epcCents(provider),
      estRevenueCents: providerRevenue.get(provider) ?? 0,
    }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  const bySection = Array.from(sectionClicks.entries())
    .map(([section, clicks]) => ({
      section,
      clicks,
      estRevenueCents: sectionRevenue.get(section) ?? 0,
    }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  const topDealIds = Array.from(dealRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([dealId]) => dealId);

  const now = new Date();
  const deals = topDealIds.length
    ? await prisma.deal.findMany({
        where: { id: { in: topDealIds } },
        include: {
          product: { include: { affiliateLinks: { where: { enabled: true } } } },
          placements: true,
        },
      })
    : [];

  const dealById = new Map(deals.map((d) => [d.id, d] as const));
  const topDeals = topDealIds
    .map((id) => {
      const d = dealById.get(id);
      if (!d) return null;
      const clicks = dealClicks.get(id) ?? 0;
      const impressions = dealImpressions.get(id) ?? 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const providers = Array.from((dealProviders.get(id) ?? new Map()).entries())
        .map(([provider, clicks]) => ({ provider, clicks, epcCents: epcCents(provider) }))
        .sort((a, b) => b.clicks - a.clicks);

      const placementsActive = activePlacementTypes(now, d.placements);
      const category = d.product.categoryOverride ?? d.product.category ?? 'unknown';

      return {
        dealId: id,
        asin: d.product.asin,
        title: d.product.title,
        category,
        clicks,
        impressions,
        ctr,
        estRevenueCents: dealRevenue.get(id) ?? 0,
        providers,
        placementsActive,
        productAffiliateProviders: d.product.affiliateLinks.map((l) => l.provider),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  // Top categories (based on top ~2000 deals by clicks to keep queries bounded).
  const dealIdsByClicks = Array.from(dealClicks.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2000)
    .map(([dealId]) => dealId);

  const categoryRows = dealIdsByClicks.length
    ? await prisma.deal.findMany({
        where: { id: { in: dealIdsByClicks } },
        select: { id: true, product: { select: { category: true, categoryOverride: true } } },
      })
    : [];

  const byCategoryClicks = new Map<string, number>();
  const byCategoryRevenue = new Map<string, number>();
  for (const row of categoryRows) {
    const category = row.product.categoryOverride ?? row.product.category ?? 'unknown';
    const clicks = dealClicks.get(row.id) ?? 0;
    const rev = dealRevenue.get(row.id) ?? 0;
    byCategoryClicks.set(category, (byCategoryClicks.get(category) ?? 0) + clicks);
    byCategoryRevenue.set(category, (byCategoryRevenue.get(category) ?? 0) + rev);
  }

  const topCategories = Array.from(byCategoryRevenue.entries())
    .map(([category, estRevenueCents]) => ({
      category,
      clicks: byCategoryClicks.get(category) ?? 0,
      estRevenueCents,
    }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents)
    .slice(0, 25);

  // Suggestions (insights only).
  const premiumCandidates = topDeals
    .filter((d) => d.impressions >= 50 && d.ctr >= 0.03 && d.placementsActive.length === 0)
    .slice(0, 10);

  const underperformingPlacements = topDeals
    .filter((d) => d.impressions >= 100 && d.placementsActive.length > 0 && d.ctr < 0.01)
    .slice(0, 10);

  const providerConfigs = await prisma.affiliateProviderConfig.findMany({
    where: { enabled: true },
    orderBy: [{ priority: 'asc' }, { provider: 'asc' }],
  });
  const enabledProviders = new Set<AffiliateProvider>(providerConfigs.map((c) => c.provider));

  const providerSuggestions = topDeals
    .map((d) => {
      const available = new Set<string>(['amazon']);
      for (const p of d.productAffiliateProviders) {
        if (enabledProviders.has(p)) available.add(p.toLowerCase());
      }
      const best = Array.from(available).sort((a, b) => epcCents(b) - epcCents(a))[0] ?? 'amazon';
      const current = d.providers[0]?.provider ?? 'amazon';
      if (best === current) return null;
      return { dealId: d.dealId, asin: d.asin, title: d.title, current, suggested: best };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .slice(0, 10);

  return {
    since,
    assumptions: {
      epcCentsByProvider: EPC_CENTS,
      note: 'Estimated revenue uses simple EPC assumptions per provider (cents per outbound click). Replace with real conversion data later.',
    },
    providerPerformance,
    bySection,
    topDeals,
    topCategories,
    suggestions: {
      premiumCandidates,
      underperformingPlacements,
      providerSuggestions,
    },
  };
}

