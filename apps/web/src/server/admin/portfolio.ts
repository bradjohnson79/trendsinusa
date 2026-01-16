import 'server-only';

import { readSitesConfig } from '@trendsinusa/shared';
import { prisma } from '@/src/server/prisma';

type Meta = {
  event: string;
  site: string;
  provider: string;
};

function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    site: sp.get('site') ?? 'unknown',
    provider: (sp.get('provider') ?? 'amazon').toLowerCase(),
  };
}

const EPC_CENTS: Record<string, number> = {
  amazon: 12,
  walmart: 10,
  target: 10,
};

function epcCents(provider: string): number {
  return EPC_CENTS[provider] ?? 0;
}

function dayKey(d: Date): string {
  // UTC day buckets for stability
  return d.toISOString().slice(0, 10);
}

export async function getPortfolioReport(params: { days: number }) {
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);
  const { config } = await readSitesConfig();

  const now = new Date();
  const liveStatuses = ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] as const;

  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { occurredAt: true, href: true, referrer: true },
    take: 75000,
    orderBy: { occurredAt: 'desc' },
  });

  // Totals + daily series per site
  const impressionsBySite = new Map<string, number>();
  const clicksBySite = new Map<string, number>();
  const revenueBySite = new Map<string, number>();
  const lastSeenClickAt = new Map<string, Date>();

  const dailyBySite = new Map<string, Map<string, { imps: number; clicks: number; revCents: number }>>();

  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    const site = meta.site;
    const day = dayKey(e.occurredAt);

    const perSite = dailyBySite.get(site) ?? new Map();
    const row = perSite.get(day) ?? { imps: 0, clicks: 0, revCents: 0 };

    if (e.href === 'event://impression') {
      impressionsBySite.set(site, (impressionsBySite.get(site) ?? 0) + 1);
      row.imps += 1;
      perSite.set(day, row);
      dailyBySite.set(site, perSite);
      continue;
    }

    if (meta.event !== 'affiliate_click') continue;

    clicksBySite.set(site, (clicksBySite.get(site) ?? 0) + 1);
    const epc = epcCents(meta.provider);
    revenueBySite.set(site, (revenueBySite.get(site) ?? 0) + epc);
    row.clicks += 1;
    row.revCents += epc;
    perSite.set(day, row);
    dailyBySite.set(site, perSite);

    const prev = lastSeenClickAt.get(site);
    if (!prev || e.occurredAt > prev) lastSeenClickAt.set(site, e.occurredAt);
  }

  function ctr(clicks: number, imps: number) {
    if (imps <= 0) return 0;
    return clicks / imps;
  }

  // Health indicators are content/ops proxies (no external analytics):
  // - products tagged for the site
  // - live deals tagged for the site
  const health = await Promise.all(
    config.sites.map(async (s) => {
      const tag = `site:${s.key}`;
      const [products, liveDeals] = await Promise.all([
        prisma.product.count({ where: { tags: { has: tag } } }),
        prisma.deal.count({
          where: {
            suppressed: false,
            status: { in: [...liveStatuses] },
            expiresAt: { gt: now },
            product: { tags: { has: tag } },
          },
        }),
      ]);
      return { key: s.key, products, liveDeals };
    }),
  );
  const healthByKey = new Map(health.map((h) => [h.key, h] as const));

  // Normalize a fixed day axis for all sites.
  const dayAxis: string[] = [];
  for (let i = params.days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayAxis.push(dayKey(d));
  }

  const sites = config.sites.map((s) => s.key);
  const bySite = sites.map((key) => {
    const imps = impressionsBySite.get(key) ?? 0;
    const clicks = clicksBySite.get(key) ?? 0;
    const rev = revenueBySite.get(key) ?? 0;
    const seriesMap = dailyBySite.get(key) ?? new Map();

    const series = dayAxis.map((day) => ({
      day,
      impressions: seriesMap.get(day)?.imps ?? 0,
      clicks: seriesMap.get(day)?.clicks ?? 0,
      estRevenueCents: seriesMap.get(day)?.revCents ?? 0,
    }));

    const last7 = series.slice(-7);
    const prev7 = series.slice(-14, -7);
    const sum = (xs: typeof series) =>
      xs.reduce((acc, r) => ({ imps: acc.imps + r.impressions, clicks: acc.clicks + r.clicks, rev: acc.rev + r.estRevenueCents }), {
        imps: 0,
        clicks: 0,
        rev: 0,
      });
    const a = sum(last7);
    const b = sum(prev7);
    const growth = {
      clicksPct: b.clicks > 0 ? (a.clicks - b.clicks) / b.clicks : null,
      revenuePct: b.rev > 0 ? (a.rev - b.rev) / b.rev : null,
    };

    return {
      site: key,
      enabled: config.sites.find((s) => s.key === key)?.enabled ?? false,
      impressions: imps,
      clicks,
      ctr: ctr(clicks, imps),
      estRevenueCents: rev,
      lastSeenClickAt: lastSeenClickAt.get(key) ?? null,
      health: healthByKey.get(key) ?? { products: 0, liveDeals: 0 },
      growth,
      series,
    };
  });

  // Portfolio totals
  const totals = bySite.reduce(
    (acc, s) => {
      acc.impressions += s.impressions;
      acc.clicks += s.clicks;
      acc.estRevenueCents += s.estRevenueCents;
      return acc;
    },
    { impressions: 0, clicks: 0, estRevenueCents: 0 },
  );

  return {
    since,
    assumptions: { epcCentsByProvider: EPC_CENTS, note: 'Traffic is proxied by tracked impressions/clicks (not full pageviews). Revenue is estimated via EPC assumptions.' },
    totals: { ...totals, ctr: ctr(totals.clicks, totals.impressions) },
    bySite,
  };
}

