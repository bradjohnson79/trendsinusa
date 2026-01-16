import 'server-only';

import type { Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/src/server/prisma';
import { getResolvedSiteKey, siteTag } from '@/src/server/site';
import { publicDealWhere } from '@/src/server/quality/standards';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getHomepageHero() {
  const fn = unstable_cache(
    async () => {
      const today = startOfToday();
      const hero = await prisma.heroRotation.findFirst({
        where: { forDate: { gte: today } },
        orderBy: { forDate: 'desc' },
      });
      if (!hero) return null;
      return { headline: hero.headline, forDate: hero.forDate };
    },
    ['home:hero'],
    { revalidate: 60 },
  );
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function getLiveDeals(limit: number) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      return await prisma.deal.findMany({
        where: publicDealWhere(tag, now),
        orderBy: { expiresAt: 'asc' },
        take: limit,
        include: { product: true },
      });
    },
    [`home:liveDeals:${limit}`],
    { revalidate: 30 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getTrendingDeals(limit: number) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      // "Trending" is a placeholder heuristic for now: highest discountPercent first, then soonest expiry.
      return await prisma.deal.findMany({
        where: publicDealWhere(tag, now),
        orderBy: [{ discountPercent: 'desc' }, { expiresAt: 'asc' }],
        take: limit,
        include: { product: true },
      });
    },
    [`home:trending:${limit}`],
    { revalidate: 60 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getEndingSoonDeals() {
  return await getLiveDeals(100);
}

export async function getProductByAsin(asin: string) {
  const fn = unstable_cache(
    async () => prisma.product.findUnique({ where: { asin } }),
    [`product:${asin}`],
    { revalidate: 300 },
  );
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function getActiveDealForAsin(asin: string) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      const where = {
        ...publicDealWhere(tag, now),
        product: { asin, tags: { has: tag }, blocked: false, title: { not: '' } },
      } satisfies Prisma.DealWhereInput;
      return await prisma.deal.findFirst({
        where,
        orderBy: { expiresAt: 'asc' },
        include: { product: true },
      });
    },
    [`productDeal:${asin}`],
    { revalidate: 30 },
  );
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function getCategoryBanners(limit: number) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      return await prisma.banner.findMany({
        where: {
          enabled: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });
    },
    [`home:banners:${limit}`],
    { revalidate: 300 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

