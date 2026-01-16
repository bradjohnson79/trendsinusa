import 'server-only';

import type { Metadata } from 'next';
import { getSiteUrl } from '@/src/server/seo/site';

export function buildSeoMeta(params: {
  title: string;
  description: string;
  canonicalPath: string; // must start with '/'
}): Metadata {
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}${params.canonicalPath}`;

  return {
    title: params.title,
    description: params.description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      title: params.title,
      description: params.description,
      siteName: 'TrendsInUSA.com',
    },
    twitter: {
      card: 'summary_large_image',
      title: params.title,
      description: params.description,
    },
  };
}

