import 'server-only';

import { prisma } from '@/src/server/prisma';
import { readSitesConfig } from '@trendsinusa/shared';

type Meta = {
  event: string;
  section: string;
  site: string;
  provider: string;
};

function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    section: sp.get('section') ?? 'unknown',
    site: sp.get('site') ?? 'unknown',
    provider: (sp.get('provider') ?? 'amazon').toLowerCase(),
  };
}

// Keep consistent across time for “normalized” reporting.
const EPC_CENTS: Record<string, number> = {
  amazon: 12,
  walmart: 10,
  target: 10,
};

function epcCents(provider: string): number {
  return EPC_CENTS[provider] ?? 0;
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7); // YYYY-MM in UTC
}

function streamFromSection(section: string): 'organic' | 'premium' | 'sponsored' | 'unknown' {
  if (section.includes('sponsored')) return 'sponsored';
  if (section.includes('premium')) return 'premium';
  if (section === 'unknown') return 'unknown';
  return 'organic';
}

export async function getExitReport(params: { months: number }) {
  const { config } = await readSitesConfig();
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - (params.months - 1));

  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { occurredAt: true, href: true, referrer: true },
    take: 150000,
    orderBy: { occurredAt: 'desc' },
  });

  const sites = config.sites.map((s) => s.key);

  // monthly[month][site] = metrics
  const monthly = new Map<string, Map<string, { imps: number; clicks: number; rev: number; byProvider: Map<string, number>; byStream: Map<string, number> }>>();

  for (const e of events) {
    const m = monthKey(e.occurredAt);
    const meta = parseReferrer(e.referrer);
    const site = sites.includes(meta.site) ? meta.site : 'unknown';
    const perMonth = monthly.get(m) ?? new Map();
    const row =
      perMonth.get(site) ??
      ({ imps: 0, clicks: 0, rev: 0, byProvider: new Map<string, number>(), byStream: new Map<string, number>() });

    // Normalize: only keep impressions + affiliate clicks. Drop product_exit and anything unknown.
    if (e.href === 'event://impression') {
      row.imps += 1;
      perMonth.set(site, row);
      monthly.set(m, perMonth);
      continue;
    }

    if (meta.event !== 'affiliate_click') continue;

    row.clicks += 1;
    const epc = epcCents(meta.provider);
    row.rev += epc;
    row.byProvider.set(meta.provider, (row.byProvider.get(meta.provider) ?? 0) + epc);
    const stream = streamFromSection(meta.section);
    row.byStream.set(stream, (row.byStream.get(stream) ?? 0) + epc);

    perMonth.set(site, row);
    monthly.set(m, perMonth);
  }

  // fixed month axis
  const axis: string[] = [];
  const now = new Date();
  for (let i = params.months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 0, 0, 0));
    axis.push(monthKey(d));
  }

  function ctr(clicks: number, imps: number) {
    if (imps <= 0) return 0;
    return clicks / imps;
  }

  const bySiteMonthly = sites.map((site) => {
    const series = axis.map((month) => {
      const row = monthly.get(month)?.get(site) ?? null;
      const imps = row?.imps ?? 0;
      const clicks = row?.clicks ?? 0;
      const rev = row?.rev ?? 0;
      const revPerVisitor = imps > 0 ? rev / imps : 0; // visitor proxy = impression
      return { month, impressions: imps, clicks, ctr: ctr(clicks, imps), estRevenueCents: rev, estRevPerVisitorCents: revPerVisitor };
    });

    // provider dependency ratios (last month)
    const lastMonth = axis[axis.length - 1]!;
    const row = monthly.get(lastMonth)?.get(site) ?? null;
    const totalRev = row?.rev ?? 0;
    const providers = Array.from((row?.byProvider ?? new Map()).entries())
      .map(([provider, rev]) => ({
        provider,
        estRevenueCents: rev,
        share: totalRev > 0 ? rev / totalRev : 0,
      }))
      .sort((a, b) => b.estRevenueCents - a.estRevenueCents);
    const topProviderShare = providers[0]?.share ?? 0;

    const streams = Array.from((row?.byStream ?? new Map()).entries())
      .map(([stream, rev]) => ({ stream, estRevenueCents: rev, share: totalRev > 0 ? rev / totalRev : 0 }))
      .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

    return { site, series, lastMonthProviders: providers, lastMonthStreams: streams, providerDependencyTopShare: topProviderShare };
  });

  // Portfolio totals
  const portfolio = axis.map((month) => {
    let imps = 0;
    let clicks = 0;
    let rev = 0;
    for (const s of sites) {
      const row = monthly.get(month)?.get(s);
      if (!row) continue;
      imps += row.imps;
      clicks += row.clicks;
      rev += row.rev;
    }
    return { month, impressions: imps, clicks, ctr: ctr(clicks, imps), estRevenueCents: rev, estRevPerVisitorCents: imps > 0 ? rev / imps : 0 };
  });

  // MoM growth for portfolio (clicks + revenue)
  const mom = portfolio.map((r, idx) => {
    const prev = portfolio[idx - 1] ?? null;
    const clicksMom = prev && prev.clicks > 0 ? (r.clicks - prev.clicks) / prev.clicks : null;
    const revMom = prev && prev.estRevenueCents > 0 ? (r.estRevenueCents - prev.estRevenueCents) / prev.estRevenueCents : null;
    return { month: r.month, clicksMom, revMom };
  });

  return {
    since,
    assumptions: {
      epcCentsByProvider: EPC_CENTS,
      visitorDefinition: 'visitor_proxy=impression (tracked DealCard impression events). Replace with unique-session when available.',
      note: 'Normalized reporting excludes product_exit and any non-affiliate events. Revenue is estimated from outbound clicks via static EPC assumptions.',
    },
    portfolio,
    mom,
    bySiteMonthly,
  };
}

