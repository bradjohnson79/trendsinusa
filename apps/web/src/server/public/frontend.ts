import 'server-only';

import type { Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/src/server/prisma';
import { getResolvedSiteKey, siteTag } from '@/src/server/site';
import { publicDealWhere } from '@/src/server/quality/standards';

function parseProviderFromOutboundUrl(outboundUrl: string): string | null {
  try {
    const u = new URL(outboundUrl, 'http://local');
    const parts = u.pathname.split('/').filter(Boolean); // out/{provider}/{asin}
    if (parts[0] !== 'out') return null;
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

export async function getHeroBackground() {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      return await prisma.banner.findFirst({
        where: {
          enabled: true,
          imageUrl: { not: null },
          category: null, // treat null-category banners as decorative hero/backdrop assets
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: { updatedAt: 'desc' },
      });
    },
    ['front:heroBackground'],
    { revalidate: 300 },
  );
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function getHeroFeaturedDeal() {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());

      // Primary: deal with an active FEATURED placement.
      const featured = await prisma.deal.findFirst({
        where: {
          ...publicDealWhere(tag, now),
          placements: { some: { type: 'FEATURED', enabled: true, startsAt: { lte: now }, endsAt: { gt: now } } },
        },
        orderBy: [{ expiresAt: 'asc' }, { updatedAt: 'desc' }],
        include: { product: true, placements: true },
      });
      if (featured) return featured;

      // Fallback: any live deal (backend-determined via query gates).
      return await prisma.deal.findFirst({
        where: publicDealWhere(tag, now),
        orderBy: [{ expiresAt: 'asc' }, { updatedAt: 'desc' }],
        include: { product: true, placements: true },
      });
    },
    ['front:heroFeaturedDeal'],
    { revalidate: 30 },
  );
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function getHomeLiveDeals(limit: number) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      return await prisma.deal.findMany({
        where: publicDealWhere(tag, now),
        orderBy: [{ aiFeatured: 'desc' }, { dealPriorityScore: 'desc' }, { expiresAt: 'asc' }],
        take: limit,
        include: { product: true, placements: true },
      });
    },
    [`front:homeLive:${limit}`],
    { revalidate: 30 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getEditorPicks(limit: number) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      return await prisma.deal.findMany({
        where: {
          ...publicDealWhere(tag, now),
          placements: {
            some: { type: { in: ['EDITORS_PICK', 'SPOTLIGHT', 'FEATURED'] }, enabled: true, startsAt: { lte: now }, endsAt: { gt: now } },
          },
        } satisfies Prisma.DealWhereInput,
        orderBy: [{ expiresAt: 'asc' }, { updatedAt: 'desc' }],
        take: limit,
        include: { product: true, placements: true },
      });
    },
    [`front:editorPicks:${limit}`],
    { revalidate: 60 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getPublicDealById(id: string) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      return await prisma.deal.findUnique({ where: { id }, include: { product: true, placements: true } }).then((d) => {
        if (!d) return null;
        // Enforce gates (unique lookup doesn't apply where).
        // Minimal checks duplicated here only to ensure correctness.
        if (d.suppressed) return null;
        if (!['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'].includes(d.status)) return null;
        if (d.expiresAt <= now) return null;
        if (!(d.product?.tags ?? []).includes(tag)) return null;
        return d;
      });
    },
    [`front:deal:${id}`],
    { revalidate: 30 },
  );
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function getOutboundProviderForDeal(params: { outboundUrl: string }) {
  return parseProviderFromOutboundUrl(params.outboundUrl);
}

