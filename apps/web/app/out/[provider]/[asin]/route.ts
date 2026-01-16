import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import type { AffiliateProvider } from '@prisma/client';
import { prisma } from '@/src/server/prisma';
import { applyAmazonTag, buildAmazonUrl, applyTemplate } from '@/src/server/affiliate/providers';
import { getResolvedSiteKeyForHost } from '@/src/server/site';
import { rateLimit, requestFingerprint } from '@/src/server/abuse/rateLimit';
import { isProviderAllowedForSite, isRequestAllowed } from '@/src/server/abuse/policy';
import { getGaConfigForSite, markGaEvent } from '@/src/server/analytics/config';

function parseTrackingParams(url: URL) {
  return {
    section: url.searchParams.get('section') ?? 'unknown',
    cta: url.searchParams.get('cta') ?? '',
    badge: url.searchParams.get('badge') ?? '',
    dealStatus: url.searchParams.get('dealStatus') ?? '',
    dealId: url.searchParams.get('dealId') ?? '',
    partner: url.searchParams.get('partner') ?? '',
  };
}

async function buildAmazonAffiliate(siteKey: string, asin: string) {
  const [cfg, product] = await Promise.all([
    prisma.affiliateConfig.findUnique({ where: { siteKey_region: { siteKey, region: 'US' } } }),
    prisma.product.findUnique({ where: { asin }, select: { productUrl: true } }),
  ]);

  const base = product?.productUrl ?? buildAmazonUrl(asin);
  const enabled = cfg?.enabled ?? false;
  const associateTag = cfg?.associateTag ?? null;
  if (!enabled || !associateTag) {
    // Global injection disabled or missing ID -> clean merchant URL.
    return { ok: true as const, url: base };
  }
  return { ok: true as const, url: applyAmazonTag(base, associateTag) };
}

async function buildProviderAffiliate(siteKey: string, provider: AffiliateProvider, asin: string) {
  if (provider === 'AMAZON') return await buildAmazonAffiliate(siteKey, asin);

  const [cfg, product] = await Promise.all([
    prisma.affiliateProviderConfig.findUnique({ where: { siteKey_provider: { siteKey, provider } } }),
    prisma.product.findUnique({
      where: { asin },
      include: { affiliateLinks: { where: { enabled: true, provider } } },
    }),
  ]);

  const link = product?.affiliateLinks?.[0];
  if (!link) return { ok: false as const, reason: 'disabled' as const }; // unavailable -> fallback upstream

  // Global injection toggle (per-site) lives in AffiliateConfig.
  const global = await prisma.affiliateConfig.findUnique({ where: { siteKey_region: { siteKey, region: 'US' } } });
  const globalEnabled = global?.enabled ?? false;
  if (!globalEnabled) {
    // Return clean provider URL (no affiliate params).
    return { ok: true as const, url: link.url };
  }

  if (!cfg?.enabled) return { ok: true as const, url: link.url }; // provider disabled -> still allow clean fallback
  if (!cfg.affiliateId) return { ok: true as const, url: link.url }; // missing ID -> clean fallback

  const finalUrl = cfg.linkTemplate
    ? applyTemplate(cfg.linkTemplate, { url: link.url, asin, affiliateId: cfg.affiliateId })
    : link.url;
  try {
    // eslint-disable-next-line no-new
    new URL(finalUrl);
    return { ok: true as const, url: finalUrl };
  } catch {
    // Bad template -> fall back to clean.
    return { ok: true as const, url: link.url };
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string; asin: string }> },
) {
  const { provider: providerRaw, asin } = await ctx.params;
  const url = new URL(req.url);
  const { section, cta, badge, dealStatus, dealId, partner } = parseTrackingParams(url);
  const host = req.headers.get('host') ?? '';
  const siteKey = await getResolvedSiteKeyForHost(host);

  if (!(await isRequestAllowed(req))) {
    return new NextResponse('Blocked.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const fp = requestFingerprint(req);
  const rl = rateLimit({ key: `out:${fp}`, limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return new NextResponse('Rate limited.', { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } });
  }

  // Provider usage boundary: site allowlist.
  const providerKey = providerRaw.toLowerCase();
  if (!(await isProviderAllowedForSite(providerKey))) {
    return new NextResponse('Provider not allowed for this site.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Special-case fallback merchant: always redirect to the clean product URL.
  if (providerKey === 'merchant') {
    const product = await prisma.product.findUnique({ where: { asin }, select: { productUrl: true } });
    const clean = product?.productUrl ?? buildAmazonUrl(asin);
    const referrer = new URLSearchParams({
      event: 'affiliate_click',
      section,
      cta,
      badge,
      dealStatus,
      site: siteKey,
      provider: 'merchant',
      ...(partner ? { partner } : {}),
    }).toString();

    await prisma.clickEvent.create({
      data: {
        kind: 'AFFILIATE_OUTBOUND',
        occurredAt: new Date(),
        href: clean,
        asin,
        dealId: dealId || null,
        productId: null,
        userAgent: req.headers.get('user-agent') ?? null,
        referrer,
      },
    });

    return NextResponse.redirect(clean);
  }

  const provider = providerRaw.toUpperCase() as AffiliateProvider;

  // Attempt requested provider; fallback to Amazon if unavailable.
  let built = await buildProviderAffiliate(siteKey, provider, asin);
  if (!built.ok) built = await buildAmazonAffiliate(siteKey, asin);

  const referrer = new URLSearchParams({
    event: 'affiliate_click',
    section,
    cta,
    badge,
    dealStatus,
    site: siteKey,
    provider: providerRaw,
    ...(partner ? { partner } : {}),
  }).toString();

  await prisma.clickEvent.create({
    data: {
      kind: 'AFFILIATE_OUTBOUND',
      occurredAt: new Date(),
      href: built.url,
      asin,
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

  return NextResponse.redirect(built.url);
}

