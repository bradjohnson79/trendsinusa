import type { DealStatus } from '@prisma/client';
import { prisma } from '@trendsinusa/db';

function deriveDealStatus(expiresAt: Date, now: Date): DealStatus {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 'EXPIRED';
  const hours = ms / (60 * 60 * 1000);
  if (hours <= 1) return 'EXPIRING_1H';
  if (hours <= 6) return 'EXPIRING_6H';
  if (hours <= 24) return 'EXPIRING_24H';
  return 'ACTIVE';
}

export async function expireDealsSweep(now: Date): Promise<{ expiredCount: number }> {
  const res = await prisma.deal.updateMany({
    where: { expiresAt: { lte: now }, status: { not: 'EXPIRED' } },
    data: { status: 'EXPIRED' },
  });
  return { expiredCount: res.count };
}

export async function reEvaluateDealStates(now: Date): Promise<{
  active: number;
  expiring24h: number;
  expiring6h: number;
  expiring1h: number;
}> {
  // Set-based updates (deterministic, avoids per-row loops).
  const t1 = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const t6 = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const t24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Exclude already-expired deals; those are handled by the sweep.
  const baseWhere = { expiresAt: { gt: now }, status: { not: 'EXPIRED' as const } };

  const [r1, r6, r24, rActive] = await Promise.all([
    prisma.deal.updateMany({
      where: { ...baseWhere, expiresAt: { gt: now, lte: t1 } },
      data: { status: 'EXPIRING_1H' },
    }),
    prisma.deal.updateMany({
      where: { ...baseWhere, expiresAt: { gt: t1, lte: t6 } },
      data: { status: 'EXPIRING_6H' },
    }),
    prisma.deal.updateMany({
      where: { ...baseWhere, expiresAt: { gt: t6, lte: t24 } },
      data: { status: 'EXPIRING_24H' },
    }),
    prisma.deal.updateMany({
      where: { ...baseWhere, expiresAt: { gt: t24 } },
      data: { status: 'ACTIVE' },
    }),
  ]);

  // Note: counts represent rows updated to each status in this run, not total rows in DB.
  return {
    expiring1h: r1.count,
    expiring6h: r6.count,
    expiring24h: r24.count,
    active: rActive.count,
  };
}

export function deriveDealStatusForDebug(expiresAt: Date, now: Date): DealStatus {
  return deriveDealStatus(expiresAt, now);
}

