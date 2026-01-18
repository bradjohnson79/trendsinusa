import { prisma } from '@trendsinusa/db';

import { runDiscoverySweep } from '../jobs/discoverySweep.js';

async function processDiscoveryCommands(now: Date) {
  const pending = await prisma.systemCommand.findMany({
    where: { type: 'DISCOVERY_SWEEP', status: 'STARTED', processedAt: null },
    orderBy: { requestedAt: 'asc' },
    take: 3,
  });

  for (const cmd of pending) {
    try {
      const result = await runDiscoverySweep({ siteKey: cmd.siteKey });
      await prisma.systemCommand.update({
        where: { id: cmd.id },
        data: { status: 'SUCCESS', processedAt: now, metadata: { ...((cmd.metadata as any) ?? {}), result } as any },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.systemCommand.update({
        where: { id: cmd.id },
        data: { status: 'FAILURE', processedAt: now, error: message },
      });
    }
  }
}

/**
 * Cron-compatible discovery runner.
 * One-shot: exit 0/1. Does NOT run ingestion.
 *
 * Optionally auto-enqueues a discovery command if DISCOVERY_ENABLED=true and
 * automationEnabled=true and the last SUCCESS was >4h ago.
 */
async function main() {
  const now = new Date();

  const auto = String(process.env.DISCOVERY_AUTO_ENQUEUE ?? 'false').toLowerCase() === 'true';
  if (auto) {
    const siteKey = process.env.SITE_KEY ?? 'trendsinusa';
    const cfg = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { automationEnabled: true } }).catch(() => null);
    const enabled = String(process.env.DISCOVERY_ENABLED ?? 'false').toLowerCase() === 'true';

    if (enabled && cfg?.automationEnabled) {
      const last = await prisma.systemCommand
        .findFirst({ where: { type: 'DISCOVERY_SWEEP', siteKey, status: 'SUCCESS' }, orderBy: { processedAt: 'desc' }, select: { processedAt: true } })
        .catch(() => null);
      const lastAt = last?.processedAt?.getTime() ?? 0;
      const hoursSince = lastAt ? (now.getTime() - lastAt) / (60 * 60 * 1000) : Infinity;
      if (hoursSince >= 4) {
        await prisma.systemCommand.create({
          data: { type: 'DISCOVERY_SWEEP', siteKey, status: 'STARTED', metadata: { requestedBy: 'scheduler', enqueuedAt: now.toISOString() } as any },
        });
      }
    }
  }

  await processDiscoveryCommands(now);
}

void main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error('[discovery] FAILURE', e);
    process.exitCode = 1;
    await prisma.$disconnect();
  });

