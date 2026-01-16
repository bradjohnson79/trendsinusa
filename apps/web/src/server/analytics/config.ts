import 'server-only';

import { cache } from 'react';
import { prisma } from '@/src/server/prisma';
import type { Prisma } from '@prisma/client';

export type GaConfig = { enabled: boolean; measurementId: string | null; lastEventAt: Date | null };

export const getGaConfigForSite = cache(async (siteKey: string): Promise<GaConfig> => {
  // NOTE: In production we always run `prisma generate` in CI/Vercel.
  // If Prisma Client is stale in local dev, this will throw and we'll treat GA as disabled.
  let row: { gaEnabled: boolean; gaMeasurementId: string | null; lastEventAt: Date | null } | null = null;
  try {
    row = await prisma.analyticsConfig.findUnique({
      where: { siteKey },
      select: { gaEnabled: true, gaMeasurementId: true, lastEventAt: true },
    });
  } catch {
    row = null;
  }
  const enabled = row?.gaEnabled ?? false;
  const measurementId = row?.gaMeasurementId ?? null;
  const lastEventAt = row?.lastEventAt ?? null;
  return { enabled, measurementId, lastEventAt };
});

export async function upsertGaConfig(params: { siteKey: string; enabled: boolean; measurementId: string | null }) {
  const data = {
    siteKey: params.siteKey,
    gaEnabled: params.enabled,
    gaMeasurementId: params.measurementId,
  } satisfies Prisma.AnalyticsConfigUncheckedCreateInput;

  return await prisma.analyticsConfig.upsert({
    where: { siteKey: params.siteKey },
    create: data,
    update: { gaEnabled: params.enabled, gaMeasurementId: params.measurementId },
  });
}

export async function markGaEvent(siteKey: string) {
  // Best-effort: update lastEventAt if a config row exists (or create a disabled placeholder).
  try {
    await prisma.analyticsConfig.upsert({
      where: { siteKey },
      create: { siteKey, gaEnabled: false, gaMeasurementId: null, lastEventAt: new Date() },
      update: { lastEventAt: new Date() },
    });
  } catch {
    // ignore
  }
}

