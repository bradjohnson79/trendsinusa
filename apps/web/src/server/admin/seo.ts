import 'server-only';

import { prisma } from '@/src/server/prisma';

export async function getSeoHealth() {
  const now = new Date();

  const [activeDealCount, activeProductCount, totalProductCount] = await Promise.all([
    prisma.deal.count({
      where: {
        suppressed: false,
        status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] },
        expiresAt: { gt: now },
      },
    }),
    prisma.deal
      .findMany({
        where: {
          suppressed: false,
          status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] },
          expiresAt: { gt: now },
        },
        select: { product: { select: { asin: true } } },
        take: 5000,
      })
      .then((rows) => new Set(rows.map((r) => r.product?.asin).filter(Boolean)).size),
    prisma.product.count(),
  ]);

  const [latestHero, latestIngestion, latestDeal, latestProduct] = await Promise.all([
    prisma.heroRotation.findFirst({ orderBy: { forDate: 'desc' }, select: { forDate: true } }),
    prisma.ingestionRun.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true, source: true },
    }),
    prisma.deal.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    prisma.product.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
  ]);

  // "Indexed pages" can’t be known without Search Console; we expose an indexable approximation.
  const indexablePagesApprox =
    3 /* /, /deals/ending-soon, /trending */ + activeProductCount;

  // Proxy for "missing meta": product pages without a live deal (meta still exists, but deal context missing).
  const productsWithoutActiveDeal = Math.max(0, totalProductCount - activeProductCount);

  return {
    indexablePagesApprox,
    activeProductCount,
    totalProductCount,
    activeDealCount,
    productsWithoutActiveDeal,
    freshness: {
      heroForDate: latestHero?.forDate ?? null,
      lastSuccessfulIngestionAt: latestIngestion?.finishedAt ?? null,
      lastSuccessfulIngestionSource: latestIngestion?.source ?? null,
      lastDealUpdatedAt: latestDeal?.updatedAt ?? null,
      lastProductUpdatedAt: latestProduct?.updatedAt ?? null,
    },
  };
}

