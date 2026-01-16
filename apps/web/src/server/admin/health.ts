import 'server-only';

import { prisma } from '@/src/server/prisma';

export async function getOpsHealth() {
  const now = new Date();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [lastIngestion, ingestionFailures24h, aiFailures24h] = await Promise.all([
    prisma.ingestionRun.findFirst({
      orderBy: { startedAt: 'desc' },
      select: { status: true, startedAt: true, finishedAt: true, error: true, source: true },
    }),
    prisma.ingestionRun.count({
      where: { startedAt: { gte: since24h }, status: 'FAILURE' },
    }),
    prisma.aIActionLog.count({
      where: { startedAt: { gte: since24h }, status: 'FAILURE' },
    }),
  ]);

  const ageMinutes =
    lastIngestion?.finishedAt != null
      ? Math.round((now.getTime() - lastIngestion.finishedAt.getTime()) / 60000)
      : null;

  return {
    lastIngestion,
    ingestionFailures24h,
    aiFailures24h,
    lastIngestionAgeMinutes: ageMinutes,
  };
}

