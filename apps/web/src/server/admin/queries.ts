import 'server-only';

import type { DealStatus } from '@prisma/client';
import { prisma } from '../prisma';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function getAdminDashboardMetrics() {
  const now = new Date();
  const startToday = startOfToday();
  const start7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const liveStatuses: DealStatus[] = ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'];
  const liveDealsWhere = {
    suppressed: false,
    status: { in: liveStatuses },
    expiresAt: { gt: now },
  };

  const [
    liveDealsCount,
    expiringIn1h,
    expiringIn6h,
    expiringIn24h,
    newProductsToday,
    aiActionsLast24h,
    affiliateClicksToday,
    affiliateClicks7d,
    alerts,
  ] = await Promise.all([
    prisma.deal.count({ where: liveDealsWhere }),
    prisma.deal.count({
      where: { ...liveDealsWhere, expiresAt: { gt: now, lte: hoursFromNow(1) } },
    }),
    prisma.deal.count({
      where: { ...liveDealsWhere, expiresAt: { gt: now, lte: hoursFromNow(6) } },
    }),
    prisma.deal.count({
      where: { ...liveDealsWhere, expiresAt: { gt: now, lte: hoursFromNow(24) } },
    }),
    prisma.product.count({ where: { createdAt: { gte: startToday } } }),
    prisma.aIActionLog.count({ where: { startedAt: { gte: hoursFromNow(-24) } } }),
    prisma.clickEvent.count({
      where: { kind: 'AFFILIATE_OUTBOUND', occurredAt: { gte: startToday } },
    }),
    prisma.clickEvent.count({
      where: { kind: 'AFFILIATE_OUTBOUND', occurredAt: { gte: start7d } },
    }),
    prisma.systemAlert.findMany({
      where: { noisy: false, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return {
    liveDealsCount,
    expiring: { in1h: expiringIn1h, in6h: expiringIn6h, in24h: expiringIn24h },
    newProductsToday,
    aiActionsLast24h,
    affiliateClicks: { today: affiliateClicksToday, last7d: affiliateClicks7d },
    alerts,
  };
}

