import 'server-only';

import { getClientEnv } from '@trendsinusa/shared';

export function getSiteUrl(): string {
  return getClientEnv().NEXT_PUBLIC_SITE_URL;
}

