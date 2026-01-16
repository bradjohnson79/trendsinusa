import 'server-only';

import { prisma } from '@/src/server/prisma';

type Parsed = {
  event: string;
  section: string;
  dealStatus: string;
  cta: string;
  badge: string;
};

function parseReferrer(referrer: string | null): Parsed {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    section: sp.get('section') ?? 'unknown',
    dealStatus: sp.get('dealStatus') ?? 'unknown',
    cta: sp.get('cta') ?? 'unknown',
    badge: sp.get('badge') ?? 'unknown',
  };
}

export async function getCtrReport(params: { days: number }) {
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);

  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { href: true, referrer: true },
    take: 20000,
    orderBy: { occurredAt: 'desc' },
  });

  const impressionsBySection = new Map<string, number>();
  const clicksBySection = new Map<string, number>();
  const impressionsByStatus = new Map<string, number>();
  const clicksByStatus = new Map<string, number>();
  const clicksByCta = new Map<string, number>();

  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    const isImpression = e.href === 'event://impression';
    const isClick = meta.event === 'affiliate_click';

    if (isImpression) {
      impressionsBySection.set(meta.section, (impressionsBySection.get(meta.section) ?? 0) + 1);
      impressionsByStatus.set(meta.dealStatus, (impressionsByStatus.get(meta.dealStatus) ?? 0) + 1);
      continue;
    }

    if (isClick) {
      clicksBySection.set(meta.section, (clicksBySection.get(meta.section) ?? 0) + 1);
      clicksByStatus.set(meta.dealStatus, (clicksByStatus.get(meta.dealStatus) ?? 0) + 1);
      clicksByCta.set(meta.cta, (clicksByCta.get(meta.cta) ?? 0) + 1);
    }
  }

  function ctr(clicks: number, imps: number) {
    if (imps <= 0) return 0;
    return clicks / imps;
  }

  const sections = Array.from(new Set([...impressionsBySection.keys(), ...clicksBySection.keys()]));
  const bySection = sections
    .map((s) => {
      const imps = impressionsBySection.get(s) ?? 0;
      const clicks = clicksBySection.get(s) ?? 0;
      return { section: s, impressions: imps, clicks, ctr: ctr(clicks, imps) };
    })
    .sort((a, b) => b.ctr - a.ctr);

  const statuses = Array.from(new Set([...impressionsByStatus.keys(), ...clicksByStatus.keys()]));
  const byDealState = statuses
    .map((st) => {
      const imps = impressionsByStatus.get(st) ?? 0;
      const clicks = clicksByStatus.get(st) ?? 0;
      return { dealStatus: st, impressions: imps, clicks, ctr: ctr(clicks, imps) };
    })
    .sort((a, b) => b.ctr - a.ctr);

  const topCtas = Array.from(clicksByCta.entries())
    .map(([cta, clicks]) => ({ cta, clicks }))
    .sort((a, b) => b.clicks - a.clicks);

  return { since, bySection, byDealState, topCtas };
}

