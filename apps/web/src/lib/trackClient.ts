'use client';

declare global {
  // GA4 global; may be absent when GA is disabled.
  // eslint-disable-next-line no-var
  var gtag: undefined | ((...args: unknown[]) => void);
}

export type TrackPayload = {
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

export function trackClient(payload: TrackPayload) {
  const body = JSON.stringify(payload);

  // Best-effort non-blocking tracking.
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon('/api/track', blob);
  } else {
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  }

  // Optional GA4 fan-out (observational only). If GA isn't enabled, `gtag` won't exist.
  if (!globalThis.gtag) return;

  if (
    payload.event === 'page_view' ||
    payload.event === 'view_item' ||
    payload.event === 'view_deal' ||
    payload.event === 'outbound_affiliate_click'
  ) {
    globalThis.gtag('event', payload.event, {
      section: payload.section,
      asin: payload.asin,
      deal_id: payload.dealId,
      urgency: payload.dealStatus,
      provider: payload.provider,
      partner: payload.partner,
    });
  }
}

