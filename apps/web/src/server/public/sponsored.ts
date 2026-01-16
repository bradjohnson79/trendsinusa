import 'server-only';

import { prisma } from '@/src/server/prisma';
import { getResolvedSiteKey, siteTag } from '@/src/server/site';

function meetsSponsoredQualityThreshold(d: {
  currentPriceCents: number;
  oldPriceCents: number | null;
  discountPercent: number | null;
}) {
  // Basic trust thresholds (conservative):
  // - must have a real markdown (oldPrice > currentPrice)
  // - avoid extreme or negative discounts
  if (d.currentPriceCents <= 0) return false;
  if (d.oldPriceCents == null) return false;
  if (d.oldPriceCents <= d.currentPriceCents) return false;
  if (d.discountPercent != null && (d.discountPercent < 5 || d.discountPercent > 95)) return false;
  return true;
}

export async function getSponsoredDeals(params: { limit: number; category?: string | null }) {
  const now = new Date();
  const tag = siteTag(await getResolvedSiteKey());
  const deals = await prisma.deal.findMany({
    where: {
      suppressed: false,
      status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] },
      expiresAt: { gt: now },
      ...(params.category
        ? { product: { category: params.category, tags: { has: tag } } }
        : { product: { tags: { has: tag } } }),
      placements: {
        some: { type: 'SPONSORED', enabled: true, startsAt: { lte: now }, endsAt: { gt: now } },
      },
    },
    include: {
      product: true,
      placements: { where: { type: 'SPONSORED' } },
    },
    orderBy: [{ expiresAt: 'asc' }],
    take: 25,
  });

  return deals.filter(meetsSponsoredQualityThreshold).slice(0, params.limit);
}

