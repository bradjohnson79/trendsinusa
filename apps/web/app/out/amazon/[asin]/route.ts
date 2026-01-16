import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/src/server/prisma';
import { applyAmazonTag, buildAmazonUrl } from '@/src/server/affiliate/providers';
import { getResolvedSiteKeyForHost } from '@/src/server/site';
import { rateLimit, requestFingerprint } from '@/src/server/abuse/rateLimit';
import { isRequestAllowed } from '@/src/server/abuse/policy';
import { getGaConfigForSite, markGaEvent } from '@/src/server/analytics/config';

function parseTrackingParams(url: URL) {
  const section = url.searchParams.get('section') ?? 'unknown';
  const cta = url.searchParams.get('cta') ?? '';
  const badge = url.searchParams.get('badge') ?? '';
  const dealStatus = url.searchParams.get('dealStatus') ?? '';
  const dealId = url.searchParams.get('dealId') ?? '';
  const partner = url.searchParams.get('partner') ?? '';
  return { section, cta, badge, dealStatus, dealId, partner };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ asin: string }> }) {
  if (!(await isRequestAllowed(req))) {
    return new NextResponse('Blocked.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const fp = requestFingerprint(req);
  const rl = rateLimit({ key: `out:${fp}`, limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return new NextResponse('Rate limited.', { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } });
  }

  const { asin } = await ctx.params;
  const url = new URL(req.url);
  const { section, cta, badge, dealStatus, dealId, partner } = parseTrackingParams(url);

  const host = req.headers.get('host') ?? '';
  const siteKey = await getResolvedSiteKeyForHost(host);

  const [cfg, product] = await Promise.all([
    prisma.affiliateConfig.findUnique({ where: { siteKey_region: { siteKey, region: 'US' } } }),
    prisma.product.findUnique({ where: { asin }, select: { productUrl: true } }),
  ]);

  const base = product?.productUrl ?? buildAmazonUrl(asin);
  const enabled = cfg?.enabled ?? false;
  const associateTag = cfg?.associateTag ?? null;
  const builtUrl = enabled && associateTag ? applyAmazonTag(base, associateTag) : base;

  const referrer = new URLSearchParams({
    event: 'affiliate_click',
    section,
    cta,
    badge,
    dealStatus,
    site: siteKey,
    ...(partner ? { partner } : {}),
  }).toString();

  await prisma.clickEvent.create({
    data: {
      kind: 'AFFILIATE_OUTBOUND',
      occurredAt: new Date(),
      href: builtUrl,
      asin,
      // Avoid extra DB reads on click path; asin + referrer metadata is sufficient.
      dealId: dealId || null,
      productId: null,
      userAgent: req.headers.get('user-agent') ?? null,
      referrer,
    },
  });

  // Observational only: keep a best-effort "last event" timestamp for GA config status.
  try {
    const ga = await getGaConfigForSite(siteKey);
    if (ga.enabled && ga.measurementId) await markGaEvent(siteKey);
  } catch {
    // ignore
  }

  return NextResponse.redirect(builtUrl);
}

