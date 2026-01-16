import 'server-only';

import type { PlacementType } from '@prisma/client';
import { prisma } from '@/src/server/prisma';
import { getResolvedSiteKey, siteTag } from '@/src/server/site';

export const PREMIUM_TYPES = ['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'] as const;
export type PremiumType = (typeof PREMIUM_TYPES)[number];

function isPremiumType(t: PlacementType): t is PremiumType {
  return t === 'SPOTLIGHT' || t === 'EDITORS_PICK' || t === 'FEATURED';
}

function buildOrder(order: readonly PremiumType[]): Record<PremiumType, number> {
  const out: Record<PremiumType, number> = { SPOTLIGHT: 0, EDITORS_PICK: 1, FEATURED: 2 };
  for (let i = 0; i < order.length; i += 1) out[order[i]!] = i;
  return out;
}

export function isPlacementActive(now: Date, p: { enabled: boolean; startsAt: Date; endsAt: Date }) {
  return p.enabled && p.startsAt <= now && p.endsAt > now;
}

export async function getPremiumDeals(params: {
  limit: number;
  category?: string | null;
  eligibleTypes?: readonly PremiumType[];
  order?: readonly PremiumType[];
}) {
  const now = new Date();
  const tag = siteTag(await getResolvedSiteKey());
  const eligibleTypes = params.eligibleTypes?.length ? params.eligibleTypes : PREMIUM_TYPES;
  const order = params.order?.length ? params.order : eligibleTypes;
  const ORDER = buildOrder(order);
  const deals = await prisma.deal.findMany({
    where: {
      suppressed: false,
      status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] },
      expiresAt: { gt: now },
      ...(params.category
        ? { product: { category: params.category, tags: { has: tag } } }
        : { product: { tags: { has: tag } } }),
      placements: {
        some: {
          enabled: true,
          startsAt: { lte: now },
          endsAt: { gt: now },
          type: { in: [...eligibleTypes] },
        },
      },
    },
    include: { product: true, placements: true },
    take: 100,
  });

  const scored: Array<{ deal: typeof deals[number]; placementType: PremiumType }> = [];
  for (const d of deals) {
    const active = d.placements.filter(
      (p): p is typeof p & { type: PremiumType } => isPlacementActive(now, p) && isPremiumType(p.type),
    );
    const best = active.sort((a, b) => ORDER[a.type] - ORDER[b.type])[0];
    if (best) scored.push({ deal: d, placementType: best.type });
  }

  scored.sort((a, b) => ORDER[a.placementType] - ORDER[b.placementType]);

  return scored.slice(0, params.limit);
}

