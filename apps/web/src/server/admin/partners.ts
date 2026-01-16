import 'server-only';

import { prisma } from '@/src/server/prisma';
import { readPartnersConfig } from '@trendsinusa/shared';

type Meta = {
  event: string;
  partner: string;
  site: string;
  provider: string;
};

function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    partner: sp.get('partner') ?? 'none',
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

export async function getPartnerMetrics(params: { days: number }) {
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);
  const { config, path } = await readPartnersConfig();

  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { occurredAt: true, href: true, referrer: true, dealId: true },
    take: 75000,
    orderBy: { occurredAt: 'desc' },
  });

  const partnerSet = new Set(config.partners.map((p) => p.key));

  const total = { impressions: 0, clicks: 0, estRevenueCents: 0 };
  const byPartner = new Map<
    string,
    { impressions: number; clicks: number; estRevenueCents: number; byProvider: Map<string, number>; dealClicks: Set<string>; organicDealClicks: Set<string> }
  >();

  // Collect organic deal clicks for cannibalization proxy (deal overlap).
  const organicDealClicks = new Set<string>();

  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    const isImpression = e.href === 'event://impression';
    const isClick = meta.event === 'affiliate_click';

    if (isImpression) total.impressions += 1;
    if (isClick) {
      total.clicks += 1;
      total.estRevenueCents += epcCents(meta.provider);
      if (!partnerSet.has(meta.partner) && e.dealId) organicDealClicks.add(e.dealId);
    }

    if (!partnerSet.has(meta.partner)) continue;

    const row =
      byPartner.get(meta.partner) ??
      ({ impressions: 0, clicks: 0, estRevenueCents: 0, byProvider: new Map<string, number>(), dealClicks: new Set<string>(), organicDealClicks });

    if (isImpression) row.impressions += 1;
    if (isClick) {
      row.clicks += 1;
      const epc = epcCents(meta.provider);
      row.estRevenueCents += epc;
      row.byProvider.set(meta.provider, (row.byProvider.get(meta.provider) ?? 0) + epc);
      if (e.dealId) row.dealClicks.add(e.dealId);
    }

    byPartner.set(meta.partner, row);
  }

  const partners = config.partners.map((p) => {
    const m = byPartner.get(p.key) ?? null;
    const impressions = m?.impressions ?? 0;
    const clicks = m?.clicks ?? 0;
    const estRevenueCents = m?.estRevenueCents ?? 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;

    const providerBreakdown = Array.from((m?.byProvider ?? new Map()).entries())
      .map(([provider, rev]) => ({ provider, estRevenueCents: rev }))
      .sort((a, b) => b.estRevenueCents - a.estRevenueCents);

    // Cannibalization proxy: share of partner-clicked deals that were also clicked organically.
    let overlap = 0;
    const dealSet = m?.dealClicks ?? new Set<string>();
    for (const id of dealSet) if (organicDealClicks.has(id)) overlap += 1;
    const overlapRate = dealSet.size > 0 ? overlap / dealSet.size : 0;

    return {
      key: p.key,
      enabled: p.enabled,
      siteKey: p.siteKey,
      scopes: p.scopes,
      tokenEnvVar: p.tokenEnvVar,
      tier: p.tier ?? 'basic',
      monetization: p.monetization,
      impressions,
      clicks,
      ctr,
      estRevenueCents,
      shareOfClicks: total.clicks > 0 ? clicks / total.clicks : 0,
      shareOfRevenue: total.estRevenueCents > 0 ? estRevenueCents / total.estRevenueCents : 0,
      providerBreakdown,
      cannibalizationProxy: { overlappingDeals: overlap, totalPartnerDealsClicked: dealSet.size, overlapRate },
    };
  });

  return {
    since,
    partnersConfigPath: path,
    totals: total,
    partners,
    assumptions: {
      epcCentsByProvider: EPC_CENTS,
      notes: [
        '“Traffic” uses tracked impressions/clicks, not full pageviews.',
        'Revenue is estimated via static EPC assumptions per provider.',
        'Cannibalization is a proxy using deal-click overlap between partner-attributed clicks and organic clicks.',
      ],
    },
  };
}

