import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/src/server/prisma';
import { rateLimit, requestFingerprint } from '@/src/server/abuse/rateLimit';
import { PARTNER_API_SCHEMA_DATE, PARTNER_API_VERSION } from '@/src/server/partners/contracts';
import { requirePartner, requireScope } from '@/src/server/partners/auth';
import { enforcePartnerGovernance, recordOverLimitRequested } from '@/src/server/partners/governance';

export async function GET(req: NextRequest, ctx: { params: Promise<{ partner: string }> }) {
  const { partner: partnerKeyRaw } = await ctx.params;
  const partnerKey = decodeURIComponent(partnerKeyRaw);

  const auth = await requirePartner(req, partnerKey);
  if (!auth.ok) return new NextResponse('Not found.', { status: auth.status });
  const { partner } = auth;

  const scope = requireScope(partner, 'categories');
  if (!scope.ok) return new NextResponse('Not found.', { status: scope.status });

  const gov = await enforcePartnerGovernance({ req, partner, endpointKey: 'v1:categories' });
  if (!gov.ok) {
    const init: ResponseInit = { status: gov.status };
    if (gov.headers) init.headers = gov.headers;
    return new NextResponse(gov.status === 404 ? 'Not found.' : 'Rate limited.', init);
  }

  const fp = requestFingerprint(req);
  const rl = rateLimit({
    key: `partner:v1:categories:${partner.key}:${fp}`,
    limit: partner.rateLimitPerMinute,
    windowMs: 60_000,
  });
  if (!rl.ok) return new NextResponse('Rate limited.', { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } });

  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? String(partner.maxLimit));
  const limit = Math.max(1, Math.min(partner.maxLimit, requestedLimit));
  if (Number.isFinite(requestedLimit) && requestedLimit > partner.maxLimit) {
    void recordOverLimitRequested(partner.key, requestedLimit, partner.maxLimit, 'v1:categories');
  }
  const now = new Date();
  const siteTag = `site:${partner.siteKey}`;

  // Pull a bounded set of live deals and aggregate in-memory for simplicity/auditability.
  const deals = await prisma.deal.findMany({
    where: {
      suppressed: false,
      status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] },
      expiresAt: { gt: now },
      product: { tags: { has: siteTag } },
    },
    select: {
      status: true,
      expiresAt: true,
      currentPriceCents: true,
      product: { select: { category: true, categoryOverride: true } },
    },
    take: 5000,
    orderBy: { updatedAt: 'desc' },
  });

  const byCategory = new Map<string, { liveDeals: number; endingSoonDeals: number; minPriceCents: number | null; maxPriceCents: number | null }>();
  for (const d of deals) {
    const category = d.product.categoryOverride ?? d.product.category ?? 'unknown';
    const row = byCategory.get(category) ?? { liveDeals: 0, endingSoonDeals: 0, minPriceCents: null, maxPriceCents: null };
    row.liveDeals += 1;
    if (d.expiresAt.getTime() - now.getTime() <= 6 * 60 * 60 * 1000) row.endingSoonDeals += 1;
    row.minPriceCents = row.minPriceCents == null ? d.currentPriceCents : Math.min(row.minPriceCents, d.currentPriceCents);
    row.maxPriceCents = row.maxPriceCents == null ? d.currentPriceCents : Math.max(row.maxPriceCents, d.currentPriceCents);
    byCategory.set(category, row);
  }

  const items = Array.from(byCategory.entries())
    .map(([category, r]) => ({ category, ...r }))
    .sort((a, b) => b.liveDeals - a.liveDeals)
    .slice(0, limit);

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

