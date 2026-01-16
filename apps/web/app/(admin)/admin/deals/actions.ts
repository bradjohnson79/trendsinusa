'use server';

import { revalidatePath } from 'next/cache';
import type { DealStatus } from '@prisma/client';

import { prisma } from '@/src/server/prisma';

function audit(message: string) {
  // Use SystemAlert as an append-only audit stream; mark noisy so it doesn't show as an ops alert.
  return prisma.systemAlert.create({
    data: { type: 'SYSTEM', severity: 'INFO', noisy: true, message },
  });
}

function deriveStatus(now: Date, expiresAt: Date): DealStatus {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 'EXPIRED';
  if (ms <= 1 * 60 * 60 * 1000) return 'EXPIRING_1H';
  if (ms <= 6 * 60 * 60 * 1000) return 'EXPIRING_6H';
  if (ms <= 24 * 60 * 60 * 1000) return 'EXPIRING_24H';
  return 'ACTIVE';
}

async function ensureIds(ids: string[]): Promise<string[]> {
  return Array.from(new Set(ids.map((x) => String(x).trim()).filter(Boolean)));
}

export async function pauseDeals(ids: string[]) {
  const dealIds = await ensureIds(ids);
  if (!dealIds.length) return;
  await prisma.deal.updateMany({ where: { id: { in: dealIds } }, data: { suppressed: true } });
  await audit(`audit:deals action=pause ids=${dealIds.join(',')}`);
  revalidatePath('/admin/deals');
}

export async function resumeDeals(ids: string[]) {
  const dealIds = await ensureIds(ids);
  if (!dealIds.length) return;
  await prisma.deal.updateMany({ where: { id: { in: dealIds } }, data: { suppressed: false } });
  await audit(`audit:deals action=resume ids=${dealIds.join(',')}`);
  revalidatePath('/admin/deals');
}

export async function forceExpireDeals(ids: string[]) {
  const dealIds = await ensureIds(ids);
  if (!dealIds.length) return;
  const now = new Date();
  await prisma.deal.updateMany({
    where: { id: { in: dealIds } },
    data: { status: 'EXPIRED', expiresAt: now, lastEvaluatedAt: now },
  });
  await audit(`audit:deals action=force_expire ids=${dealIds.join(',')}`);
  revalidatePath('/admin/deals');
}

export async function reevaluateDeals(ids: string[]) {
  const dealIds = await ensureIds(ids);
  if (!dealIds.length) return;
  const now = new Date();
  const deals = await prisma.deal.findMany({ where: { id: { in: dealIds } }, select: { id: true, expiresAt: true } });
  await prisma.$transaction(
    deals.map((d) =>
      prisma.deal.update({
        where: { id: d.id },
        data: { status: deriveStatus(now, d.expiresAt), lastEvaluatedAt: now },
      }),
    ),
  );
  await audit(`audit:deals action=reevaluate ids=${dealIds.join(',')}`);
  revalidatePath('/admin/deals');
}

export async function featureDeals(ids: string[]) {
  const dealIds = await ensureIds(ids);
  if (!dealIds.length) return;
  const now = new Date();

  const deals = await prisma.deal.findMany({ where: { id: { in: dealIds } }, select: { id: true, expiresAt: true } });
  await prisma.$transaction(
    deals.map((d) =>
      prisma.dealPlacement.upsert({
        where: { dealId_type: { dealId: d.id, type: 'FEATURED' } },
        create: {
          dealId: d.id,
          type: 'FEATURED',
          enabled: true,
          startsAt: now,
          endsAt: d.expiresAt,
        },
        update: {
          enabled: true,
          startsAt: now,
          endsAt: d.expiresAt,
        },
      }),
    ),
  );

  await audit(`audit:deals action=feature ids=${dealIds.join(',')}`);
  revalidatePath('/admin/deals');
}

