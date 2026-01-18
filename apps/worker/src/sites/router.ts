import type { SiteConfig } from '@trendsinusa/shared/server';
import { readSitesConfig } from '@trendsinusa/shared/server';
import { prisma } from '@trendsinusa/db';

function siteTag(key: string) {
  return `site:${key}`;
}

function categoryForSite(p: { category: string | null; categoryOverride: string | null }) {
  return p.categoryOverride ?? p.category ?? null;
}

function matchesSite(site: SiteConfig, category: string | null): boolean {
  if (!site.enabled) return false;
  if (site.defaultCategories.length === 0) return true; // include-all site
  if (!category) return false;
  return site.defaultCategories.includes(category);
}

export async function recomputeProductSiteTags(): Promise<{ productsScanned: number; productsUpdated: number }> {
  const { config } = await readSitesConfig();
  const enabledSites = config.sites.filter((s) => s.enabled);

  // Early dev safety: keep bounded.
  const products = await prisma.product.findMany({
    select: { id: true, category: true, categoryOverride: true, tags: true },
    take: 5000,
    orderBy: { updatedAt: 'desc' },
  });

  let updated = 0;
  for (const p of products) {
    const category = categoryForSite(p);
    const desiredSiteTags = enabledSites
      .filter((s) => matchesSite(s, category))
      .map((s) => siteTag(s.key));

    const nonSiteTags = p.tags.filter((t) => !t.startsWith('site:'));
    const nextTags = Array.from(new Set([...nonSiteTags, ...desiredSiteTags]));

    // Fast compare
    if (nextTags.length === p.tags.length && nextTags.every((t, i) => t === p.tags[i])) continue;

    await prisma.product.update({
      where: { id: p.id },
      data: { tags: nextTags },
    });
    updated += 1;
  }

  return { productsScanned: products.length, productsUpdated: updated };
}

