import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/src/server/prisma';
import { rateLimit, requestFingerprint } from '@/src/server/abuse/rateLimit';
import { requirePartner } from '@/src/server/partners/auth';
import { publicDealWhere } from '@/src/server/quality/standards';
import { enforcePartnerGovernance, recordOverLimitRequested } from '@/src/server/partners/governance';

export async function GET(req: NextRequest, ctx: { params: Promise<{ partner: string }> }) {
  const { partner: partnerKey } = await ctx.params;
  const auth = await requirePartner(req, decodeURIComponent(partnerKey));
  if (!auth.ok) return new NextResponse('Not found.', { status: auth.status });
  const { partner } = auth;

  if (!partner.scopes.includes('feed')) return new NextResponse('Not found.', { status: 404 });

  const gov = await enforcePartnerGovernance({ req, partner, endpointKey: 'feed' });
  if (!gov.ok) {
    const init: ResponseInit = { status: gov.status };
    if (gov.headers) init.headers = gov.headers;
    return new NextResponse(gov.status === 404 ? 'Not found.' : 'Rate limited.', init);
  }

  const fp = requestFingerprint(req);
  const rl = rateLimit({ key: `partnerFeed:${partner.key}:${fp}`, limit: partner.rateLimitPerMinute, windowMs: 60_000 });
  if (!rl.ok) return new NextResponse('Rate limited.', { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } });

  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? '50');
  const max = Math.min(100, partner.maxLimit);
  const limit = Math.max(1, Math.min(max, requestedLimit));
  if (Number.isFinite(requestedLimit) && requestedLimit > max) {
    void recordOverLimitRequested(partner.key, requestedLimit, max, 'feed');
  }
  const now = new Date();

  // Filter by partner's site. Site routing is via Product.tags.
  const siteTag = `site:${partner.siteKey}`;
  const deals = await prisma.deal.findMany({
    where: {
      ...publicDealWhere(siteTag, now),
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
    include: { product: true },
  });

  const items = deals.map((d) => {
    // Partner-safe outbound: always through our redirect, with partner attribution.
    const out = new URL(`/out/amazon/${encodeURIComponent(d.product.asin)}`, req.nextUrl.origin);
    out.searchParams.set('section', `partner_feed:${partner.key}`);
    out.searchParams.set('cta', 'feed');
    out.searchParams.set('badge', 'feed');
    out.searchParams.set('dealStatus', d.status);
    out.searchParams.set('dealId', d.id);
    out.searchParams.set('partner', partner.key);

    return {
      asin: d.product.asin,
      title: d.product.title,
      imageUrl: d.product.imageUrl,
      category: d.product.categoryOverride ?? d.product.category,
      currentPriceCents: d.currentPriceCents,
      oldPriceCents: d.oldPriceCents,
      currency: d.currency,
      expiresAt: d.expiresAt.toISOString(),
      productUrl: d.product.productUrl,
      outboundUrl: out.toString(),
      partner: partner.key,
      site: partner.siteKey,
    };
  });

  return NextResponse.json({
    partner: { key: partner.key, name: partner.branding.name, siteKey: partner.siteKey },
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  });
}

