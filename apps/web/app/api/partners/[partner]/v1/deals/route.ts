import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/src/server/prisma';
import { rateLimit, requestFingerprint } from '@/src/server/abuse/rateLimit';
import { PARTNER_API_SCHEMA_DATE, PARTNER_API_VERSION } from '@/src/server/partners/contracts';
import { requirePartner, requireScope } from '@/src/server/partners/auth';
import { publicDealWhere } from '@/src/server/quality/standards';
import { enforcePartnerGovernance, recordOverLimitRequested } from '@/src/server/partners/governance';

export async function GET(req: NextRequest, ctx: { params: Promise<{ partner: string }> }) {
  const { partner: partnerKeyRaw } = await ctx.params;
  const partnerKey = decodeURIComponent(partnerKeyRaw);

  const auth = await requirePartner(req, partnerKey);
  if (!auth.ok) return new NextResponse('Not found.', { status: auth.status });
  const { partner } = auth;

  const scope = requireScope(partner, 'feed');
  if (!scope.ok) return new NextResponse('Not found.', { status: scope.status });

  const gov = await enforcePartnerGovernance({ req, partner, endpointKey: 'v1:deals' });
  if (!gov.ok) {
    const init: ResponseInit = { status: gov.status };
    if (gov.headers) init.headers = gov.headers;
    return new NextResponse(gov.status === 404 ? 'Not found.' : 'Rate limited.', init);
  }

  const fp = requestFingerprint(req);
  const rl = rateLimit({
    key: `partner:v1:deals:${partner.key}:${fp}`,
    limit: partner.rateLimitPerMinute,
    windowMs: 60_000,
  });
  if (!rl.ok) return new NextResponse('Rate limited.', { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } });

  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? String(partner.maxLimit));
  const limit = Math.max(1, Math.min(partner.maxLimit, requestedLimit));
  if (Number.isFinite(requestedLimit) && requestedLimit > partner.maxLimit) {
    void recordOverLimitRequested(partner.key, requestedLimit, partner.maxLimit, 'v1:deals');
  }
  const now = new Date();
  const siteTag = `site:${partner.siteKey}`;

  const deals = await prisma.deal.findMany({
    where: {
      ...publicDealWhere(siteTag, now),
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
    include: { product: true },
  });

  const origin = req.nextUrl.origin;
  const items = deals.map((d) => {
    const out = new URL(`/out/amazon/${encodeURIComponent(d.product.asin)}`, origin);
    out.searchParams.set('section', `partner_api:v1:deals:${partner.key}`);
    out.searchParams.set('cta', 'api');
    out.searchParams.set('badge', 'api');
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
      outboundUrl: out.toString(),
    };
  });

  return NextResponse.json(
    {
      meta: {
        version: PARTNER_API_VERSION,
        schemaDate: PARTNER_API_SCHEMA_DATE,
        generatedAt: new Date().toISOString(),
        partner: { key: partner.key, siteKey: partner.siteKey },
      },
      count: items.length,
      items,
    },
    {
      headers: {
        'x-partner-api-version': String(PARTNER_API_VERSION),
        'x-partner-api-schema-date': PARTNER_API_SCHEMA_DATE,
      },
    },
  );
}

