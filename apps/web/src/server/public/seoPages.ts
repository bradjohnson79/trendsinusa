import 'server-only';

import type { DealStatus } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/src/server/prisma';
import { getResolvedSiteKey, siteTag } from '@/src/server/site';

const LIVE_STATUSES: DealStatus[] = ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'];

export async function getLiveCategories(): Promise<string[]> {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      const rows = await prisma.deal.findMany({
        where: {
          suppressed: false,
          status: { in: LIVE_STATUSES },
          expiresAt: { gt: now },
          product: { category: { not: null }, tags: { has: tag } },
        },
        select: { product: { select: { category: true } } },
        take: 5000,
      });

      const set = new Set<string>();
      for (const r of rows) {
        const c = r.product?.category;
        if (c) set.add(c);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
    ['seo:liveCategories'],
    { revalidate: 300 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getLiveDealsByCategory(category: string, limit: number) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      return await prisma.deal.findMany({
        where: {
          suppressed: false,
          status: { in: LIVE_STATUSES },
          expiresAt: { gt: now },
          product: { category, tags: { has: tag } },
        },
        orderBy: { expiresAt: 'asc' },
        take: limit,
        include: { product: true },
      });
    },
    [`seo:category:${category}:${limit}`],
    { revalidate: 60 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getLiveDealsByPriceBand(params: { minCents?: number; maxCents: number }, limit: number) {
  const key = `seo:price:${params.minCents ?? 'min'}-${params.maxCents}:${limit}`;
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      return await prisma.deal.findMany({
        where: {
          suppressed: false,
          status: { in: LIVE_STATUSES },
          expiresAt: { gt: now },
          product: { tags: { has: tag } },
          currentPriceCents: {
            ...(params.minCents != null ? { gte: params.minCents } : {}),
            lte: params.maxCents,
          },
        },
        orderBy: { expiresAt: 'asc' },
        take: limit,
        include: { product: true },
      });
    },
    [key],
    { revalidate: 60 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getDealsEndingWithinHours(hours: number, limit: number) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const end = new Date(Date.now() + hours * 60 * 60 * 1000);
      const tag = siteTag(await getResolvedSiteKey());
      return await prisma.deal.findMany({
        where: {
          suppressed: false,
          status: { in: LIVE_STATUSES },
          expiresAt: { gt: now, lte: end },
          product: { tags: { has: tag } },
        },
        orderBy: { expiresAt: 'asc' },
        take: limit,
        include: { product: true },
      });
    },
    [`seo:endingWithin:${hours}:${limit}`],
    { revalidate: 30 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getDealsEndingToday(limit: number) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const tag = siteTag(await getResolvedSiteKey());
      return await prisma.deal.findMany({
        where: {
          suppressed: false,
          status: { in: LIVE_STATUSES },
          expiresAt: { gt: now, lte: end },
          product: { tags: { has: tag } },
        },
        orderBy: { expiresAt: 'asc' },
        take: limit,
        include: { product: true },
      });
    },
    [`seo:endingToday:${limit}`],
    { revalidate: 60 },
  );
  try {
    return await fn();
  } catch {
    return [];
  }
}

