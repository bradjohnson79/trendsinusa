import 'server-only';

import { prisma } from '@/src/server/prisma';

type Meta = {
  event: string;
  section: string;
  dealStatus: string;
  provider: string;
  site: string;
};

function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    section: sp.get('section') ?? 'unknown',
    dealStatus: sp.get('dealStatus') ?? 'unknown',
    provider: (sp.get('provider') ?? 'amazon').toLowerCase(),
    site: sp.get('site') ?? 'unknown',
  };
}

const EPC_CENTS: Record<string, number> = { amazon: 12, walmart: 10, target: 10 };
const epcCents = (p: string) => EPC_CENTS[p] ?? 0;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function stddev(xs: number[]): number {
  if (xs.length <= 1) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function coeffOfVariation(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  if (mean <= 0) return 0;
  return stddev(xs) / mean;
}

export async function getHoldReport(params: { days: number }) {
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
        select: { id: true, expiresAt: true, currentPriceCents: true, product: { select: { category: true, categoryOverride: true } } },
      })
    : [];
  const dealById = new Map(deals.map((d) => [d.id, d] as const));

  const revByCategory = new Map<string, number>();
  const revByProvider = new Map<string, number>();
  const revByDealStatus = new Map<string, number>();

  const clicksByExpiryBucket = new Map<string, number>();
  const revByExpiryBucket = new Map<string, number>();

  const dailyRev = new Map<string, number>(); // day -> rev

  let totalImps = 0;
  let totalClicks = 0;
  let totalRev = 0;

  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    if (e.href === 'event://impression') {
      totalImps += 1;
      continue;
    }
    if (meta.event !== 'affiliate_click') continue;

    const epc = epcCents(meta.provider);
    totalClicks += 1;
    totalRev += epc;
    revByProvider.set(meta.provider, (revByProvider.get(meta.provider) ?? 0) + epc);
    revByDealStatus.set(meta.dealStatus, (revByDealStatus.get(meta.dealStatus) ?? 0) + epc);

    const day = dayKey(e.occurredAt);
    dailyRev.set(day, (dailyRev.get(day) ?? 0) + epc);

    const dealId = e.dealId ?? null;
    if (!dealId) continue;
    const d = dealById.get(dealId);
    if (!d) continue;

    const category = d.product.categoryOverride ?? d.product.category ?? 'unknown';
    revByCategory.set(category, (revByCategory.get(category) ?? 0) + epc);

    const hoursToExpiry = (d.expiresAt.getTime() - e.occurredAt.getTime()) / (60 * 60 * 1000);
    const bucket =
      hoursToExpiry <= 1 ? 'lte_1h' : hoursToExpiry <= 6 ? 'lte_6h' : hoursToExpiry <= 24 ? 'lte_24h' : 'gt_24h';
    clicksByExpiryBucket.set(bucket, (clicksByExpiryBucket.get(bucket) ?? 0) + 1);
    revByExpiryBucket.set(bucket, (revByExpiryBucket.get(bucket) ?? 0) + epc);
  }

  const ctr = totalImps > 0 ? totalClicks / totalImps : 0;

  const topCategories = Array.from(revByCategory.entries())
    .map(([category, estRevenueCents]) => ({ category, estRevenueCents }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents)
    .slice(0, 15);

  const topProviders = Array.from(revByProvider.entries())
    .map(([provider, estRevenueCents]) => ({ provider, estRevenueCents, share: totalRev > 0 ? estRevenueCents / totalRev : 0 }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  const byDealState = Array.from(revByDealStatus.entries())
    .map(([dealStatus, estRevenueCents]) => ({ dealStatus, estRevenueCents, share: totalRev > 0 ? estRevenueCents / totalRev : 0 }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  const byTimeToExpiry = Array.from(new Set([...clicksByExpiryBucket.keys(), ...revByExpiryBucket.keys()]))
    .map((bucket) => ({ bucket, clicks: clicksByExpiryBucket.get(bucket) ?? 0, estRevenueCents: revByExpiryBucket.get(bucket) ?? 0 }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  // Stability / predictability indicators
  const daysAxis: string[] = [];
  for (let i = params.days - 1; i >= 0; i -= 1) daysAxis.push(dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  const series = daysAxis.map((d) => ({ day: d, estRevenueCents: dailyRev.get(d) ?? 0 }));
  const values = series.map((r) => r.estRevenueCents);
  const cv = coeffOfVariation(values);

  // Seasonal hint (simple): day-of-week distribution of revenue
  const dowRev = new Map<number, number>(); // 0-6 UTC
  for (const [day, rev] of dailyRev.entries()) {
    const d = new Date(`${day}T00:00:00.000Z`);
    const dow = d.getUTCDay();
    dowRev.set(dow, (dowRev.get(dow) ?? 0) + rev);
  }
  const byDow = Array.from(dowRev.entries())
    .map(([dow, estRevenueCents]) => ({ dow, estRevenueCents }))
    .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

  // Operational cost proxy: ingestion frequency + failures in window
  const runs = await prisma.ingestionRun.findMany({
    where: { startedAt: { gte: since } },
    select: { status: true, startedAt: true, finishedAt: true },
    take: 5000,
    orderBy: { startedAt: 'desc' },
  });
  const runsTotal = runs.length;
  const runsFailed = runs.filter((r) => r.status === 'FAILURE').length;
  const avgDurationMs = (() => {
    const ds = runs
      .map((r) => (r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null))
      .filter((x): x is number => x != null && x >= 0);
    if (ds.length === 0) return null;
    return Math.round(ds.reduce((a, b) => a + b, 0) / ds.length);
  })();

  // Risk alerts (quiet)
  const alerts: Array<{ level: 'info' | 'warn'; message: string }> = [];
  if ((topProviders[0]?.share ?? 0) >= 0.9) alerts.push({ level: 'warn', message: 'Provider dependency risk: top provider >= 90% of estimated revenue.' });
  if (runsFailed > 0) alerts.push({ level: 'warn', message: `Ingestion reliability: ${runsFailed}/${runsTotal} runs failed in the last ${params.days} days.` });
  if (cv >= 1.0) alerts.push({ level: 'warn', message: 'Revenue volatility is high (coefficient of variation ≥ 1.0). Consider smoothing strategies.' });

  // Recommendations (insights only)
  const recommendations: string[] = [];
  if (byTimeToExpiry.length > 0) {
    const best = byTimeToExpiry[0]!;
    recommendations.push(`Time-to-expiry: strongest bucket by estimated revenue is ${best.bucket}. Consider emphasizing that state in placement rules (manual).`);
  }
  if (topCategories.length > 0) recommendations.push(`Category focus: top category by estimated revenue is "${topCategories[0]!.category}".`);
  if (runsTotal > params.days * 2) recommendations.push('Operational cost: ingestion appears frequent; consider increasing cache windows or reducing ingestion cadence (manual decision).');

  return {
    since,
    totals: { impressions: totalImps, clicks: totalClicks, ctr, estRevenueCents: totalRev },
    drivers: { topCategories, topProviders, byDealState },
    timeToExpiry: byTimeToExpiry,
    stability: { coefficientOfVariation: cv, byDow },
    ops: { ingestionRuns: { total: runsTotal, failed: runsFailed, avgDurationMs } },
    alerts,
    recommendations,
    assumptions: {
      epcCentsByProvider: EPC_CENTS,
      trafficDefinition: 'traffic_proxy=tracked impressions/clicks (DealCard impressions + outbound clicks)',
      revenueDefinition: 'estimated via EPC cents per provider',
    },
  };
}

