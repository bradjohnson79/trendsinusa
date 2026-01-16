'use client';

import { useEffect } from 'react';
import { trackClient } from '@/src/lib/trackClient';

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

export function TrackImpression(props: { payload: TrackPayload }) {
  useEffect(() => {
    trackClient(props.payload);
  }, [props.payload]);

  return null;
}

