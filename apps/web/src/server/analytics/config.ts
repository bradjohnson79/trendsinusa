import 'server-only';

import { cache } from 'react';
import { prisma } from '@/src/server/prisma';

export type GaConfig = { enabled: boolean; measurementId: string | null; lastEventAt: Date | null };

export const getGaConfigForSite = cache(async (siteKey: string): Promise<GaConfig> => {
  // Be defensive: if Prisma Client is stale (e.g. dev server not restarted after a migration),
  // `prisma.analyticsConfig` may not exist yet. In that case, treat GA as disabled.
  const model = (prisma as any).analyticsConfig as
    | undefined
    | {
        findUnique: (args: unknown) => Promise<{ gaEnabled: boolean; gaMeasurementId: string | null; lastEventAt: Date | null } | null>;
      };
  if (!model?.findUnique) return { enabled: false, measurementId: null, lastEventAt: null };

  const row = await model.findUnique({
    where: { siteKey },
    select: { gaEnabled: true, gaMeasurementId: true, lastEventAt: true },
  });
  return {
    enabled: row?.gaEnabled ?? false,
    measurementId: row?.gaMeasurementId ?? null,
    lastEventAt: row?.lastEventAt ?? null,
  };
});

export async function upsertGaConfig(params: { siteKey: string; enabled: boolean; measurementId: string | null }) {
  const model = (prisma as any).analyticsConfig as undefined | { upsert: (args: unknown) => Promise<unknown> };
  if (!model?.upsert) throw new Error('AnalyticsConfig model missing (restart dev server / prisma generate).');

  return await model.upsert({
    where: { siteKey: params.siteKey },
    create: { siteKey: params.siteKey, gaEnabled: params.enabled, gaMeasurementId: params.measurementId },
    update: { gaEnabled: params.enabled, gaMeasurementId: params.measurementId },
  });
}

export async function markGaEvent(siteKey: string) {
  // Best-effort: update lastEventAt if a config row exists (or create a disabled placeholder).
  const model = (prisma as any).analyticsConfig as undefined | { upsert: (args: unknown) => Promise<unknown> };
  if (!model?.upsert) return;

  await model.upsert({
    where: { siteKey },
    create: { siteKey, gaEnabled: false, gaMeasurementId: null, lastEventAt: new Date() },
    update: { lastEventAt: new Date() },
  });
}

