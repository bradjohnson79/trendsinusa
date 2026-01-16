import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/src/server/prisma';
import { rateLimit, requestFingerprint } from '@/src/server/abuse/rateLimit';
import { PARTNER_API_SCHEMA_DATE, PARTNER_API_VERSION } from '@/src/server/partners/contracts';
import { requirePartner, requireScope } from '@/src/server/partners/auth';
import { enforcePartnerGovernance } from '@/src/server/partners/governance';
import { getSignals } from '@/src/server/signals/core';

export async function GET(req: NextRequest, ctx: { params: Promise<{ partner: string }> }) {
  const { partner: partnerKeyRaw } = await ctx.params;
  const partnerKey = decodeURIComponent(partnerKeyRaw);

  const auth = await requirePartner(req, partnerKey);
  if (!auth.ok) return new NextResponse('Not found.', { status: auth.status });
  const { partner } = auth;

  const scope = requireScope(partner, 'trends');
  if (!scope.ok) return new NextResponse('Not found.', { status: scope.status });

  const gov = await enforcePartnerGovernance({ req, partner, endpointKey: 'v1:loop-health' });
  if (!gov.ok) {
    const init: ResponseInit = { status: gov.status };
    if (gov.headers) init.headers = gov.headers;
    return new NextResponse(gov.status === 404 ? 'Not found.' : 'Rate limited.', init);
  }

  const fp = requestFingerprint(req);
  const rl = rateLimit({
    key: `partner:v1:loopHealth:${partner.key}:${fp}`,
    limit: partner.rateLimitPerMinute,
    windowMs: 60_000,
  });
  if (!rl.ok) return new NextResponse('Rate limited.', { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } });

  const days = Math.max(7, Math.min(90, Number(req.nextUrl.searchParams.get('days') ?? '30')));
  const tier = partner.tier ?? 'basic';

  // Fast feedback for the flywheel: show partner-attributed signals only.
  const signals = await getSignals({ days, partnerKey: partner.key, siteKey: partner.siteKey, tier });

  // Reduced latency proxy for this partner's site: last updated deal for the site.
  const siteTag = `site:${partner.siteKey}`;
  const latestDeal = await prisma.deal.findFirst({
    where: { product: { tags: { has: siteTag } } },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });

  const recommendations: string[] = [];
  if (signals.totals.impressions === 0) recommendations.push('No impressions recorded. Ensure your embed includes impression beacons.');
  if (signals.totals.clicks === 0) recommendations.push('No clicks recorded. Ensure outbound URLs use /out/* with partner attribution.');
  if (signals.totals.ctr > 0 && signals.totals.ctr < 0.01) recommendations.push('CTR is low. Consider surfacing fewer, higher-quality deals.');
  if (latestDeal?.updatedAt && Date.now() - latestDeal.updatedAt.getTime() > 2 * 60 * 60 * 1000) {
    recommendations.push('Inventory looks stale (>2h). Check ingestion freshness for your site.');
  }

  return NextResponse.json(
    {
      meta: {
        version: PARTNER_API_VERSION,
        schemaDate: PARTNER_API_SCHEMA_DATE,
        generatedAt: new Date().toISOString(),
        partner: { key: partner.key, siteKey: partner.siteKey },
      },
      flywheel: 'partners→clicks→signals→better_deals→partner_yield→more_partners',
      window: { days, since: signals.since.toISOString() },
      freshness: { latestDealUpdatedAt: latestDeal?.updatedAt?.toISOString() ?? null },
      totals: signals.totals,
      outputs: signals.outputs,
      recommendations,
    },
    {
      headers: {
        'x-partner-api-version': String(PARTNER_API_VERSION),
        'x-partner-api-schema-date': PARTNER_API_SCHEMA_DATE,
      },
    },
  );
}

