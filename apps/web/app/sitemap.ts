import type { MetadataRoute } from 'next';

import { prisma } from '@/src/server/prisma';
import { getSiteUrl } from '@/src/server/seo/site';
import { getLiveCategories } from '@/src/server/public/seoPages';
import { getCurrentSiteKey, siteTag } from '@/src/server/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  // Only include active product pages (products with at least one live deal).
  const now = new Date();
  const tag = siteTag(getCurrentSiteKey());
  const activeDeals = await prisma.deal.findMany({
    where: {
      suppressed: false,
      status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] },
      expiresAt: { gt: now },
      product: { tags: { has: tag } },
    },
    select: { id: true, updatedAt: true, product: { select: { asin: true, updatedAt: true } } },
    take: 5000,
    orderBy: { updatedAt: 'desc' },
  });

  const products = activeDeals
    .map((d) => d.product)
    .filter((p): p is { asin: string; updatedAt: Date } => !!p);

  const uniqueByAsin = new Map<string, Date>();
  for (const p of products) {
    const prev = uniqueByAsin.get(p.asin);
    if (!prev || p.updatedAt > prev) uniqueByAsin.set(p.asin, p.updatedAt);
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${siteUrl}/contact`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${siteUrl}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${siteUrl}/affiliate-disclosure`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const dedupedProductRoutes: MetadataRoute.Sitemap = Array.from(uniqueByAsin.entries()).map(
    ([asin, updatedAt]) => ({
      url: `${siteUrl}/product/${encodeURIComponent(asin)}`,
      lastModified: updatedAt,
      changeFrequency: 'daily',
      priority: 0.6,
    }),
  );

  const categories = await getLiveCategories();
  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${siteUrl}/category/${encodeURIComponent(c)}`,
    changeFrequency: 'hourly',
    priority: 0.6,
  }));

  // Deal detail pages (active deals only).
  const dealRoutes: MetadataRoute.Sitemap = activeDeals.map((d) => ({
    url: `${siteUrl}/deal/${encodeURIComponent(d.id)}`,
    changeFrequency: 'hourly',
    priority: 0.7,
  }));

  // Locked frontend phase: sitemap only includes the canonical public surfaces.
  // Admin remains blocked via robots.ts and admin layout metadata.
  return [...staticRoutes, ...categoryRoutes, ...dedupedProductRoutes, ...dealRoutes];
}

