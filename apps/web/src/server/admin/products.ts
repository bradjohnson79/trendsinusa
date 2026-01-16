import 'server-only';

import type { DealStatus, IngestionSource } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/src/server/prisma';
import { readSitesConfig } from '@trendsinusa/shared';

export type ProductTag = 'evergreen' | 'seasonal' | 'impulse' | 'suppressed';

export type AdminProductsFilters = {
  q?: string;
  category?: string;
  tag?: ProductTag | 'all';
  source?: IngestionSource | 'all';
  hasActiveDeal?: 'all' | 'yes' | 'no';
  site?: string | 'all';
};

export type AdminProductRow = {
  id: string;
  asin: string;
  title: string;
  imageUrl: string | null;
  category: string | null;
  categoryOverride: string | null;
  source: IngestionSource;
  rating: number | null;
  reviewCount: number | null;
  blocked: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  derived: {
    effectiveCategory: string | null;
    hasOverride: boolean;
    visibilitySites: string[];
    coreTags: ProductTag[];
    activeDealCount: number;
  };
};

const LIVE_STATUSES: DealStatus[] = ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'];
const CORE_TAGS: readonly ProductTag[] = ['evergreen', 'seasonal', 'impulse', 'suppressed'] as const;

function normalizeSiteTags(tags: string[]): string[] {
  return tags.filter((t) => t.startsWith('site:')).map((t) => t.slice('site:'.length));
}

function normalizeCoreTags(tags: string[], blocked: boolean): ProductTag[] {
  const out: ProductTag[] = [];
  for (const t of CORE_TAGS) if (tags.includes(t)) out.push(t);
  if (blocked && !out.includes('suppressed')) out.push('suppressed');
  return out;
}

export async function getAdminProducts(params: { limit: number; cursor?: string | null; filters: AdminProductsFilters }) {
  const now = new Date();
  const f = params.filters;

  const where: Prisma.ProductWhereInput = {};

  if (f.source && f.source !== 'all') where.source = f.source;

  if (f.site && f.site !== 'all') {
    where.tags = { has: `site:${f.site}` };
  }

  if (f.category && f.category.trim()) {
    const c = f.category.trim();
    where.OR = [{ categoryOverride: c }, { category: c }];
  }

  if (f.tag && f.tag !== 'all') {
    if (f.tag === 'suppressed') {
      where.OR = [{ blocked: true }, { tags: { has: 'suppressed' } }];
    } else {
      where.tags = { ...(where.tags ?? {}), has: f.tag };
    }
  }

  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    where.OR = [...(where.OR ?? []), { asin: { contains: q } }, { title: { contains: q, mode: 'insensitive' } }];
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      asin: true,
      title: true,
      imageUrl: true,
      category: true,
      categoryOverride: true,
      source: true,
      rating: true,
      reviewCount: true,
      blocked: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const nextCursor = products.length > params.limit ? products[params.limit]!.id : null;
  const page = products.slice(0, params.limit);
  const productIds = page.map((p) => p.id);

  const activeDeals = productIds.length
    ? await prisma.deal.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, suppressed: false, status: { in: LIVE_STATUSES }, expiresAt: { gt: now } },
        _count: { _all: true },
      })
    : [];
  const activeByProduct = new Map(activeDeals.map((r) => [r.productId, r._count._all] as const));

  const filteredProductIds =
    f.hasActiveDeal && f.hasActiveDeal !== 'all'
      ? page
          .filter((p) => {
            const n = activeByProduct.get(p.id) ?? 0;
            return f.hasActiveDeal === 'yes' ? n > 0 : n === 0;
          })
          .map((p) => p.id)
      : null;

  const finalPage = (filteredProductIds ? page.filter((p) => filteredProductIds.includes(p.id)) : page).map((p) => {
    const activeDealCount = activeByProduct.get(p.id) ?? 0;
    const sites = normalizeSiteTags(p.tags);
    const coreTags = normalizeCoreTags(p.tags, p.blocked);
    const effectiveCategory = p.categoryOverride ?? p.category ?? null;
    const row: AdminProductRow = {
      ...p,
      derived: {
        effectiveCategory,
        hasOverride: !!p.categoryOverride && p.categoryOverride.trim().length > 0,
        visibilitySites: sites,
        coreTags,
        activeDealCount,
      },
    };
    return row;
  });

  const sites = await readSitesConfig().then((x) => x.config.sites.map((s) => ({ key: s.key, enabled: s.enabled })));
  return { nextCursor, products: finalPage, sites };
}

export async function getAdminProductDetail(asin: string) {
  const now = new Date();
  const p = await prisma.product.findUnique({
    where: { asin },
    select: {
      id: true,
      asin: true,
      title: true,
      imageUrl: true,
      productUrl: true,
      category: true,
      categoryOverride: true,
      source: true,
      externalId: true,
      rating: true,
      reviewCount: true,
      blocked: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!p) return null;

  const deals = await prisma.deal.findMany({
    where: { productId: p.id },
    select: { id: true, status: true, suppressed: true, expiresAt: true, discountPercent: true, currentPriceCents: true, oldPriceCents: true, currency: true, updatedAt: true },
    orderBy: [{ expiresAt: 'asc' }],
    take: 50,
  });

  const activeDeals = deals.filter((d) => !d.suppressed && LIVE_STATUSES.includes(d.status) && d.expiresAt > now);

  // Audit notes are recorded into SystemAlert; show last few relevant entries.
  const audit = await prisma.systemAlert.findMany({
    where: { type: 'SYSTEM', noisy: true, message: { contains: `audit:product asin=${p.asin}` } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true, message: true },
  });

  return { product: p, deals, activeDealsCount: activeDeals.length, audit };
}

