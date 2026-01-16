import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/src/server/prisma';

type Meta = { event: string; site: string; partner: string };
function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    site: sp.get('site') ?? 'unknown',
    partner: sp.get('partner') ?? 'none',
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ dealId: string }> }) {
  const { dealId: raw } = await ctx.params;
  const dealId = decodeURIComponent(raw);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since }, dealId },
    select: { href: true, referrer: true },
    take: 100000,
    orderBy: { occurredAt: 'desc' },
  });

  let impressions = 0;
  let clicks = 0;
  const bySite = new Map<string, { impressions: number; clicks: number }>();
  const byPartner = new Map<string, { clicks: number }>();

  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    const isImpression = e.href === 'event://impression';
    const isClick = meta.event === 'affiliate_click';
    const site = meta.site;
    const row = bySite.get(site) ?? { impressions: 0, clicks: 0 };

    if (isImpression) {
      impressions += 1;
      row.impressions += 1;
    }
    if (isClick) {
      clicks += 1;
      row.clicks += 1;
      const p = meta.partner || 'none';
      const pr = byPartner.get(p) ?? { clicks: 0 };
      pr.clicks += 1;
      byPartner.set(p, pr);
    }

    bySite.set(site, row);
  }

  const ctr = impressions > 0 ? clicks / impressions : 0;

  return NextResponse.json({
    since: since.toISOString(),
    impressions,
    clicks,
    ctr,
    bySite: Array.from(bySite.entries())
      .map(([site, r]) => ({ site, ...r, ctr: r.impressions > 0 ? r.clicks / r.impressions : 0 }))
      .sort((a, b) => b.clicks - a.clicks),
    byPartner: Array.from(byPartner.entries())
      .map(([partner, r]) => ({ partner, ...r }))
      .sort((a, b) => b.clicks - a.clicks),
    aiNotes: {
      available: false,
      note: 'Deal-level AI notes are not stored on the Deal model yet. (Audit trail is available via SystemAlert for admin actions.)',
    },
  });
}

