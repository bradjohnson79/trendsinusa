import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getServerEnv } from '@trendsinusa/shared';
import { rateLimit, requestFingerprint } from '@/src/server/abuse/rateLimit';
import { PARTNER_API_SCHEMA_DATE, PARTNER_API_VERSION } from '@/src/server/partners/contracts';
import { requirePartner, requireScope } from '@/src/server/partners/auth';
import { getPartnerStatement } from '@/src/server/partners/monetization';
import { enforcePartnerGovernance } from '@/src/server/partners/governance';

export async function GET(req: NextRequest, ctx: { params: Promise<{ partner: string }> }) {
  const env = getServerEnv();
  // No forced activation: statements are only available in preview/active mode.
  if (env.ECOSYSTEM_BILLING_MODE === 'off') return new NextResponse('Not found.', { status: 404 });

  const { partner: partnerKeyRaw } = await ctx.params;
  const partnerKey = decodeURIComponent(partnerKeyRaw);

  const auth = await requirePartner(req, partnerKey);
  if (!auth.ok) return new NextResponse('Not found.', { status: auth.status });
  const { partner } = auth;

  const scope = requireScope(partner, 'billing');
  if (!scope.ok) return new NextResponse('Not found.', { status: scope.status });

  const gov = await enforcePartnerGovernance({ req, partner, endpointKey: 'v1:statement' });
  if (!gov.ok) {
    const init: ResponseInit = { status: gov.status };
    if (gov.headers) init.headers = gov.headers;
    return new NextResponse(gov.status === 404 ? 'Not found.' : 'Rate limited.', init);
  }

  const fp = requestFingerprint(req);
  const rl = rateLimit({
    key: `partner:v1:statement:${partner.key}:${fp}`,
    limit: partner.rateLimitPerMinute,
    windowMs: 60_000,
  });
  if (!rl.ok) return new NextResponse('Rate limited.', { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } });

  const days = Math.max(7, Math.min(90, Number(req.nextUrl.searchParams.get('days') ?? '30')));

  const statement = await getPartnerStatement({
    days,
    partner: {
      key: partner.key,
      siteKey: partner.siteKey,
      tier: partner.tier ?? 'basic',
      monetization: partner.monetization,
    },
  });

  return NextResponse.json(
    {
      meta: {
        version: PARTNER_API_VERSION,
        schemaDate: PARTNER_API_SCHEMA_DATE,
        generatedAt: new Date().toISOString(),
        partner: { key: partner.key, siteKey: partner.siteKey },
      },
      statement,
    },
    {
      headers: {
        'x-partner-api-version': String(PARTNER_API_VERSION),
        'x-partner-api-schema-date': PARTNER_API_SCHEMA_DATE,
      },
    },
  );
}

