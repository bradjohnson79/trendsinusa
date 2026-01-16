import 'server-only';

import { prisma } from '@/src/server/prisma';
import { applyMinThreshold, clampTopN } from './privacy';

type Meta = {
  event: string;
  section: string;
  dealStatus: string;
  provider: string;
  site: string;
  partner: string;
};

function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    section: sp.get('section') ?? 'unknown',
    dealStatus: sp.get('dealStatus') ?? 'unknown',
    provider: (sp.get('provider') ?? 'amazon').toLowerCase(),
    site: sp.get('site') ?? 'unknown',
    partner: sp.get('partner') ?? 'none',
  };
}

// Conservative EPC assumptions (cents/click). Keep stable over time.
const EPC_CENTS: Record<string, number> = { amazon: 12, walmart: 10, target: 10 };
const epcCents = (p: string) => EPC_CENTS[p] ?? 0;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type SignalsParams = {
  days: number;
  siteKey?: string;
  partnerKey?: string; // if set, only include partner-attributed clicks
  tier: 'basic' | 'pro';
};

export async function getSignals(params: SignalsParams) {
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);

  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { occurredAt: true, href: true, referrer: true, dealId: true },
    take: 100000,
    orderBy: { occurredAt: 'desc' },
  });

  const dealIds = Array.from(new Set(events.map((e) => e.dealId).filter(Boolean))) as string[];
  const deals = dealIds.length
    ? await prisma.deal.findMany({
        where: { id: { in: dealIds } },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          currentPriceCents: true,
          oldPriceCents: true,
          product: { select: { category: true, categoryOverride: true } },
        },
      })
    : [];
  const dealById = new Map(deals.map((d) => [d.id, d] as const));

  // Aggregates
  const impressionsByCategory = new Map<string, number>();
  const clicksByCategory = new Map<string, number>();
  const revByCategory = new Map<string, number>();

  const clicksByProvider = new Map<string, number>();
  const revByProvider = new Map<string, number>();

  const clicksByDealState = new Map<string, number>();
  const revByDealState = new Map<string, number>();

  const clicksByExpiryBucket = new Map<string, number>();
  const revByExpiryBucket = new Map<string, number>();

  const dailyRev = new Map<string, number>(); // day -> revenue

  // Price volatility proxy: distribution of (old-current)/old among clicked deals, per category.
  const discountSamplesByCategory = new Map<string, number[]>();

  let totalImps = 0;
  let totalClicks = 0;
  let totalRev = 0;

  for (const e of events) {
    const meta = parseReferrer(e.referrer);

    if (params.siteKey && meta.site !== params.siteKey) continue;
    if (params.partnerKey && meta.partner !== params.partnerKey) continue;

    const dealId = e.dealId ?? null;
    const d = dealId ? dealById.get(dealId) : null;
    const category = d ? (d.product.categoryOverride ?? d.product.category ?? 'unknown') : 'unknown';

    if (e.href === 'event://impression') {
      totalImps += 1;
      impressionsByCategory.set(category, (impressionsByCategory.get(category) ?? 0) + 1);
      continue;
    }

    if (meta.event !== 'affiliate_click') continue;
    totalClicks += 1;

    const epc = epcCents(meta.provider);
    totalRev += epc;

    clicksByProvider.set(meta.provider, (clicksByProvider.get(meta.provider) ?? 0) + 1);
    revByProvider.set(meta.provider, (revByProvider.get(meta.provider) ?? 0) + epc);

    clicksByDealState.set(meta.dealStatus, (clicksByDealState.get(meta.dealStatus) ?? 0) + 1);
    revByDealState.set(meta.dealStatus, (revByDealState.get(meta.dealStatus) ?? 0) + epc);

    clicksByCategory.set(category, (clicksByCategory.get(category) ?? 0) + 1);
    revByCategory.set(category, (revByCategory.get(category) ?? 0) + epc);

    const day = dayKey(e.occurredAt);
    dailyRev.set(day, (dailyRev.get(day) ?? 0) + epc);

    if (d) {
      const hoursToExpiry = (d.expiresAt.getTime() - e.occurredAt.getTime()) / (60 * 60 * 1000);
      const bucket =
        hoursToExpiry <= 1 ? 'lte_1h' : hoursToExpiry <= 6 ? 'lte_6h' : hoursToExpiry <= 24 ? 'lte_24h' : 'gt_24h';
      clicksByExpiryBucket.set(bucket, (clicksByExpiryBucket.get(bucket) ?? 0) + 1);
      revByExpiryBucket.set(bucket, (revByExpiryBucket.get(bucket) ?? 0) + epc);

      // Discount sample (as a volatility proxy)
      if (d.oldPriceCents && d.oldPriceCents > 0 && d.oldPriceCents >= d.currentPriceCents) {
        const disc = (d.oldPriceCents - d.currentPriceCents) / d.oldPriceCents;
        const arr = discountSamplesByCategory.get(category) ?? [];
        arr.push(disc);
        discountSamplesByCategory.set(category, arr);
      }
    }
  }

  const ctr = totalImps > 0 ? totalClicks / totalImps : 0;

  // Category momentum = last 7d vs prior 7d click share (proxy). (Basic safe; no user-level).
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const clicksByCategory7 = new Map<string, number>();
  const clicksByCategoryPrev7 = new Map<string, number>();
  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    if (params.siteKey && meta.site !== params.siteKey) continue;
    if (params.partnerKey && meta.partner !== params.partnerKey) continue;
    if (meta.event !== 'affiliate_click') continue;
    const dealId = e.dealId ?? null;
    const d = dealId ? dealById.get(dealId) : null;
    const category = d ? (d.product.categoryOverride ?? d.product.category ?? 'unknown') : 'unknown';
    const m = e.occurredAt >= cutoff ? clicksByCategory7 : clicksByCategoryPrev7;
    m.set(category, (m.get(category) ?? 0) + 1);
  }

  function shareMap(m: Map<string, number>): Map<string, number> {
    const total = Array.from(m.values()).reduce((a, b) => a + b, 0);
    const out = new Map<string, number>();
    for (const [k, v] of m.entries()) out.set(k, total > 0 ? v / total : 0);
    return out;
  }

  const share7 = shareMap(clicksByCategory7);
  const sharePrev7 = shareMap(clicksByCategoryPrev7);

  const categoryMomentumRaw = Array.from(new Set([...share7.keys(), ...sharePrev7.keys()])).map((category) => {
    const s7 = share7.get(category) ?? 0;
    const sp = sharePrev7.get(category) ?? 0;
    return {
      category,
      clicks: (clicksByCategory.get(category) ?? 0),
      impressions: (impressionsByCategory.get(category) ?? 0),
      share7d: s7,
      sharePrev7d: sp,
      deltaShare: s7 - sp,
      estRevenueCents: revByCategory.get(category) ?? 0,
    };
  });

  // Minimum thresholds to reduce leakage for smaller sites/partners.
  const min = params.tier === 'pro' ? { minClicks: 10, minImpressions: 50 } : { minClicks: 20, minImpressions: 100 };
  const categoryMomentum = clampTopN(
    applyMinThreshold(categoryMomentumRaw, min).sort((a, b) => b.deltaShare - a.deltaShare),
    params.tier === 'pro' ? 25 : 10,
  );

  const topCategories = clampTopN(
    applyMinThreshold(
      Array.from(revByCategory.entries()).map(([category, estRevenueCents]) => ({
        category,
        estRevenueCents,
        clicks: clicksByCategory.get(category) ?? 0,
        impressions: impressionsByCategory.get(category) ?? 0,
      })),
      min,
    ).sort((a, b) => b.estRevenueCents - a.estRevenueCents),
    params.tier === 'pro' ? 25 : 10,
  );

  const providers = Array.from(revByProvider.entries())
    .map(([provider, estRevenueCents]) => ({
      provider,
      clicks: clicksByProvider.get(provider) ?? 0,
      estRevenueCents,
      share: totalRev > 0 ? estRevenueCents / totalRev : 0,
    }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  const dealStates = Array.from(revByDealState.entries())
    .map(([dealStatus, estRevenueCents]) => ({
      dealStatus,
      clicks: clicksByDealState.get(dealStatus) ?? 0,
      estRevenueCents,
      share: totalRev > 0 ? estRevenueCents / totalRev : 0,
    }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  const lifecycle = (() => {
    // Deal lifecycle pattern: average lifespan among clicked deals (createdAt -> expiresAt)
    const ls: number[] = [];
    for (const d of deals) {
      const lifetimeHours = (d.expiresAt.getTime() - d.createdAt.getTime()) / (60 * 60 * 1000);
      if (Number.isFinite(lifetimeHours) && lifetimeHours >= 0 && lifetimeHours <= 24 * 30) ls.push(lifetimeHours);
    }
    const avg = ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : null;
    return { avgLifetimeHours: avg, samples: ls.length };
  })();

  const priceVolatility = (() => {
    // Proxy: per-category stddev of discount samples (clicked deals).
    function stddev(xs: number[]): number {
      if (xs.length <= 1) return 0;
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const v = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (xs.length - 1);
      return Math.sqrt(v);
    }
    const rows = Array.from(discountSamplesByCategory.entries()).map(([category, xs]) => ({
      category,
      samples: xs.length,
      discountStdDev: stddev(xs),
      discountMean: xs.reduce((a, b) => a + b, 0) / (xs.length || 1),
      clicks: clicksByCategory.get(category) ?? 0,
      impressions: impressionsByCategory.get(category) ?? 0,
    }));
    return clampTopN(applyMinThreshold(rows, min).sort((a, b) => b.discountStdDev - a.discountStdDev), params.tier === 'pro' ? 25 : 10);
  })();

  const timeToExpiry = Array.from(new Set([...clicksByExpiryBucket.keys(), ...revByExpiryBucket.keys()]))
    .map((bucket) => ({
      bucket,
      clicks: clicksByExpiryBucket.get(bucket) ?? 0,
      estRevenueCents: revByExpiryBucket.get(bucket) ?? 0,
    }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  // Only aggregated outputs; no per-deal/userAgent/user fields.
  return {
    since,
    window: { days: params.days },
    assumptions: { epcCentsByProvider: EPC_CENTS, thresholds: min },
    totals: { impressions: totalImps, clicks: totalClicks, ctr, estRevenueCents: totalRev },
    outputs: {
      categoryMomentum,
      topCategories,
      providers,
      dealStates,
      timeToExpiry,
      lifecycle,
      ...(params.tier === 'pro' ? { priceVolatility } : {}),
    },
  };
}

