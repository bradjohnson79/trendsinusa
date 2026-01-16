import 'server-only';

import type { Prisma } from '@prisma/client';

const SOURCE_STALE_HOURS = 72;

// White-label guardrails: minimal, non-controversial constraints.
// These are meant to protect credibility and keep partners/licensees from surfacing low-quality content.
export function publicDealWhere(siteTag: string, now: Date): Prisma.DealWhereInput {
  const cutoff = new Date(now.getTime() - SOURCE_STALE_HOURS * 60 * 60 * 1000);
  return {
    approved: true,
    suppressed: false,
    status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] },
    expiresAt: { gt: now },
    currentPriceCents: { gt: 0 },
    OR: [{ oldPriceCents: null }, { oldPriceCents: { gt: 0 } }],
    product: {
      tags: { has: siteTag },
      blocked: false,
      title: { not: '' },
      // Fail-closed compliance: if source data is missing/stale, do not render.
      sourceFetchedAt: { gt: cutoff },
    },
  };
}

export function isPriceSane(d: { currentPriceCents: number; oldPriceCents: number | null }): boolean {
  if (d.currentPriceCents <= 0) return false;
  if (d.oldPriceCents == null) return true;
  // Allow equal/greater old price only.
  return d.oldPriceCents >= d.currentPriceCents;
}

