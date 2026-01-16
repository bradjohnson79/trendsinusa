import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/src/server/prisma';
import { rateLimit, requestFingerprint } from '@/src/server/abuse/rateLimit';
import { PARTNER_API_SCHEMA_DATE, PARTNER_API_VERSION } from '@/src/server/partners/contracts';
import { requirePartner, requireScope } from '@/src/server/partners/auth';
import { enforcePartnerGovernance } from '@/src/server/partners/governance';

type Meta = { event: string; partner: string; site: string; dealStatus: string };
function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    partner: sp.get('partner') ?? 'none',
    site: sp.get('site') ?? 'unknown',
    dealStatus: sp.get('dealStatus') ?? 'unknown',
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ partner: string }> }) {
  const { partner: partnerKeyRaw } = await ctx.params;
  const partnerKey = decodeURIComponent(partnerKeyRaw);

  const auth = await requirePartner(req, partnerKey);
  if (!auth.ok) return new NextResponse('Not found.', { status: auth.status });
  const { partner } = auth;

  const scope = requireScope(partner, 'trends');
  if (!scope.ok) return new NextResponse('Not found.', { status: scope.status });

  const gov = await enforcePartnerGovernance({ req, partner, endpointKey: 'v1:trends' });
  if (!gov.ok) {
    const init: ResponseInit = { status: gov.status };
    if (gov.headers) init.headers = gov.headers;
    return new NextResponse(gov.status === 404 ? 'Not found.' : 'Rate limited.', init);
  }

  const fp = requestFingerprint(req);
  const rl = rateLimit({
    key: `partner:v1:trends:${partner.key}:${fp}`,
    limit: partner.rateLimitPerMinute,
    windowMs: 60_000,
  });
  if (!rl.ok) return new NextResponse('Rate limited.', { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } });

  const windowHours = Math.max(1, Math.min(168, Number(req.nextUrl.searchParams.get('hours') ?? '24')));
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const siteTag = `site:${partner.siteKey}`;
  const now = new Date();

  // Snapshot 1: current live inventory counts (deal state buckets)
  const [liveDeals, expiring1h, expiring6h, expiring24h] = await Promise.all([
    prisma.deal.count({
      where: { suppressed: false, status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] }, expiresAt: { gt: now }, product: { tags: { has: siteTag } } },
    }),
    prisma.deal.count({
      where: { suppressed: false, status: 'EXPIRING_1H', expiresAt: { gt: now }, product: { tags: { has: siteTag } } },
    }),
    prisma.deal.count({
      where: { suppressed: false, status: 'EXPIRING_6H', expiresAt: { gt: now }, product: { tags: { has: siteTag } } },
    }),
    prisma.deal.count({
      where: { suppressed: false, status: 'EXPIRING_24H', expiresAt: { gt: now }, product: { tags: { has: siteTag } } },
    }),
  ]);

  // Snapshot 2: trending by clicks (partner-attributed) in window
  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { dealId: true, referrer: true, href: true },
    take: 50000,
    orderBy: { occurredAt: 'desc' },
  });

  const clicksByDeal = new Map<string, number>();
  const clicksByDealState = new Map<string, number>();
  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    if (meta.event !== 'affiliate_click') continue;
    if (meta.partner !== partner.key) continue;
    if (!e.dealId) continue;
    clicksByDeal.set(e.dealId, (clicksByDeal.get(e.dealId) ?? 0) + 1);
    clicksByDealState.set(meta.dealStatus, (clicksByDealState.get(meta.dealStatus) ?? 0) + 1);
  }

  const topDealIds = Array.from(clicksByDeal.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([id]) => id);

  const topDeals = topDealIds.length
    ? await prisma.deal.findMany({
        where: { id: { in: topDealIds }, product: { tags: { has: siteTag } } },
        include: { product: true },
      })
    : [];
  const byId = new Map(topDeals.map((d) => [d.id, d] as const));

  const trendingDeals = topDealIds
    .map((id) => {
      const d = byId.get(id);
      if (!d) return null;
      return {
        dealId: id,
        asin: d.product.asin,
        title: d.product.title,
        category: d.product.categoryOverride ?? d.product.category,
        clicks: clicksByDeal.get(id) ?? 0,
        status: d.status,
        expiresAt: d.expiresAt.toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  return NextResponse.json(
    {
      meta: {
        version: PARTNER_API_VERSION,
        schemaDate: PARTNER_API_SCHEMA_DATE,
        generatedAt: new Date().toISOString(),
        partner: { key: partner.key, siteKey: partner.siteKey },
      },
      window: { hours: windowHours, since: since.toISOString() },
      inventory: {
        liveDeals,
        expiring: { in1h: expiring1h, in6h: expiring6h, in24h: expiring24h },
      },
      performance: {
        clicksByDealState: Object.fromEntries(clicksByDealState.entries()),
        trendingDeals,
      },
    },
    {
      headers: {
        'x-partner-api-version': String(PARTNER_API_VERSION),
        'x-partner-api-schema-date': PARTNER_API_SCHEMA_DATE,
      },
    },
  );
}

