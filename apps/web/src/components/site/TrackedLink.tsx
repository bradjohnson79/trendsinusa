'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { trackClient } from '@/src/lib/trackClient';

// Lightweight click tracker: emits a single best-effort client event (internal + optional GA via TrackImpression).
export function TrackedLink(
  props: ComponentProps<typeof Link> & {
    track?: {
      event: 'outbound_affiliate_click' | 'view_deal';
      section: string;
      asin?: string;
      dealId?: string;
      dealStatus?: string;
      provider?: string;
      partner?: string;
    };
  },
) {
  const { track, onClick, ...rest } = props;

  return (
    <Link
      {...rest}
      onClick={(e) => {
        if (track) {
          trackClient({
            event: track.event,
            section: track.section,
            ...(track.asin ? { asin: track.asin } : {}),
            ...(track.dealId ? { dealId: track.dealId } : {}),
            ...(track.dealStatus ? { dealStatus: track.dealStatus } : {}),
            ...(track.provider ? { provider: track.provider } : {}),
            ...(track.partner ? { partner: track.partner } : {}),
          });
        }
        onClick?.(e);
      }}
    />
  );
}

