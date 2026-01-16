import 'server-only';

import { prisma } from '@/src/server/prisma';
import { readPartnersConfig } from '@trendsinusa/shared';
import { getOpsHealth } from '@/src/server/admin/health';
import { getGovernanceReport } from '@/src/server/admin/governance';

type Meta = { event: string; partner: string; site: string; provider: string };
function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    partner: sp.get('partner') ?? 'none',
    site: sp.get('site') ?? 'unknown',
    provider: (sp.get('provider') ?? 'amazon').toLowerCase(),
  };
}

const EPC_CENTS: Record<string, number> = { amazon: 12, walmart: 10, target: 10 };
function epcCents(provider: string): number {
  return EPC_CENTS[provider] ?? 0;
}

function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return (cur - prev) / prev;
}

export async function getNetworkLoopHealth(params: { days: number }) {
  // Dominant flywheel (single loop):
  // Partners → more attributed clicks → better signals/optimization → better surfaced deals → higher partner yield → more partners.
  const now = new Date();
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const split = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [{ config }, governance, ops] = await Promise.all([
    readPartnersConfig(),
    getGovernanceReport({ limit: 250 }),
    getOpsHealth(),
  ]);

  const partnerKeys = new Set(config.partners.map((p) => p.key));

  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: params.days >= 14 ? since : since14d } },
    select: { occurredAt: true, href: true, referrer: true },
    take: 100000,
    orderBy: { occurredAt: 'desc' },
  });

  const agg = {
    impressions7: 0,
    clicks7: 0,
    rev7: 0,
    impressionsPrev7: 0,
    clicksPrev7: 0,
    revPrev7: 0,
    byPartnerClicks7: new Map<string, number>(),
    byPartnerClicksPrev7: new Map<string, number>(),
    byPartnerImps7: new Map<string, number>(),
    byPartnerImpsPrev7: new Map<string, number>(),
  };

  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    const isPartner = partnerKeys.has(meta.partner);
    const inLast7 = e.occurredAt >= split;
    const isImpression = e.href === 'event://impression';
    const isClick = meta.event === 'affiliate_click';
    if (!isPartner) continue;

    if (isImpression) {
      if (inLast7) {
        agg.impressions7 += 1;
        agg.byPartnerImps7.set(meta.partner, (agg.byPartnerImps7.get(meta.partner) ?? 0) + 1);
      } else {
        agg.impressionsPrev7 += 1;
        agg.byPartnerImpsPrev7.set(meta.partner, (agg.byPartnerImpsPrev7.get(meta.partner) ?? 0) + 1);
      }
    }
    if (isClick) {
      const epc = epcCents(meta.provider);
      if (inLast7) {
        agg.clicks7 += 1;
        agg.rev7 += epc;
        agg.byPartnerClicks7.set(meta.partner, (agg.byPartnerClicks7.get(meta.partner) ?? 0) + 1);
      } else {
        agg.clicksPrev7 += 1;
        agg.revPrev7 += epc;
        agg.byPartnerClicksPrev7.set(meta.partner, (agg.byPartnerClicksPrev7.get(meta.partner) ?? 0) + 1);
      }
    }
  }

  const activeThreshold = 5;
  const activePartners7 = config.partners.filter((p) => (agg.byPartnerClicks7.get(p.key) ?? 0) >= activeThreshold).length;
  const activePartnersPrev7 = config.partners.filter((p) => (agg.byPartnerClicksPrev7.get(p.key) ?? 0) >= activeThreshold).length;

  // Quality signals (derived, deterministic)
  const throttled = governance.partners.filter((p) => p.action === 'throttle').length;
  const suspended = governance.partners.filter((p) => p.action === 'suspend' || p.action === 'terminate').length;

  const ctr7 = agg.impressions7 > 0 ? agg.clicks7 / agg.impressions7 : 0;
  const ctrPrev7 = agg.impressionsPrev7 > 0 ? agg.clicksPrev7 / agg.impressionsPrev7 : 0;

  const yieldPerClick7 = agg.clicks7 > 0 ? agg.rev7 / agg.clicks7 : 0;
  const yieldPerClickPrev7 = agg.clicksPrev7 > 0 ? agg.revPrev7 / agg.clicksPrev7 : 0;

  // Reduced latency proxy: how fresh the ingestion is.
  const ingestionAgeMinutes = ops.lastIngestionAgeMinutes;

  return {
    now,
    window: { days: params.days, since },
    flywheel: 'partners→clicks→signals→better_deals→partner_yield→more_partners' as const,
    participation: {
      configuredPartners: config.partners.length,
      activePartners7d: activePartners7,
      activePartnersPrev7d: activePartnersPrev7,
      activePartnersGrowthPct: pctChange(activePartners7, activePartnersPrev7),
    },
    quality: {
      governance: { throttledPartners: throttled, suspendedPartners: suspended },
      ctr7d: ctr7,
      ctrPrev7d: ctrPrev7,
      ctrGrowthPct: pctChange(ctr7, ctrPrev7),
    },
    yield: {
      estRevenueCents7d: agg.rev7,
      estRevenueCentsPrev7d: agg.revPrev7,
      revenueGrowthPct: pctChange(agg.rev7, agg.revPrev7),
      yieldPerClickCents7d: yieldPerClick7,
      yieldPerClickCentsPrev7d: yieldPerClickPrev7,
      yieldPerClickGrowthPct: pctChange(yieldPerClick7, yieldPerClickPrev7),
    },
    latency: {
      lastIngestion: ops.lastIngestion,
      lastIngestionAgeMinutes: ingestionAgeMinutes,
    },
  };
}

