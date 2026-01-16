import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/src/server/prisma';
import { getCurrentSiteKey } from '@/src/server/site';
import { rateLimit, requestFingerprint } from '@/src/server/abuse/rateLimit';
import { isRequestAllowed } from '@/src/server/abuse/policy';

type TrackPayload = {
  event:
    | 'page_view'
    | 'view_item'
    | 'view_deal'
    | 'outbound_affiliate_click'
    | 'impression'
    | 'product_exit';
  section: string;
  asin?: string;
  dealId?: string;
  dealStatus?: string;
  ctaVariant?: string;
  badgeVariant?: string;
  provider?: string;
  partner?: string;
};

function toReferrerParams(p: TrackPayload): string {
  const sp = new URLSearchParams();
  sp.set('section', p.section);
  if (p.dealStatus) sp.set('dealStatus', p.dealStatus);
  if (p.ctaVariant) sp.set('cta', p.ctaVariant);
  if (p.badgeVariant) sp.set('badge', p.badgeVariant);
  if (p.provider) sp.set('provider', p.provider);
  sp.set('site', getCurrentSiteKey());
  if (p.partner) sp.set('partner', p.partner);
  sp.set('event', p.event);
  return sp.toString();
}

export async function POST(req: NextRequest) {
  if (!(await isRequestAllowed(req))) return NextResponse.json({ ok: false }, { status: 403 });

  const fp = requestFingerprint(req);
  const rl = rateLimit({ key: `track:${fp}`, limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } });
  }

  const payload = (await req.json()) as TrackPayload;

  const asin = payload.asin ?? null;
  const dealId = payload.dealId ?? null;
  const userAgent = req.headers.get('user-agent') ?? null;
  const referrer = toReferrerParams(payload);

  // We log all tracking events into ClickEvent without changing schema:
  // - impressions and product exits use href=event://...
  // - affiliate redirects use actual amazon href (handled elsewhere)
  const href = `event://${payload.event}`;

  await prisma.clickEvent.create({
    data: {
      kind: 'AFFILIATE_OUTBOUND',
      occurredAt: new Date(),
      href,
      asin,
      dealId,
      // Avoid DB lookups on hot paths; asin is sufficient for aggregation.
      productId: null,
      userAgent,
      referrer,
    },
  });

  return NextResponse.json({ ok: true });
}

