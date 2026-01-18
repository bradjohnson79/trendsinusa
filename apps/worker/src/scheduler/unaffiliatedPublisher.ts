import { prisma } from '@trendsinusa/db';
import { runUnaffiliatedPostGeneration } from '../jobs/unaffiliatedPosts.js';

/**
 * Cron-compatible unaffiliated publishing runner.
 *
 * Strategy:
 * - Process pending SystemCommand(type=UNAFFILIATED_PUBLISHER)
 * - Optionally auto-enqueue when enabled (intended to be called hourly by cron)
 *
 * Environment:
 * - UNAFFILIATED_PUBLISHER_AUTO_ENQUEUE=true|false (default false)
 * - UNAFFILIATED_PUBLISHER_MIN_HOURS (default 6)
 * - UNAFFILIATED_PUBLISHER_MAX_HOURS (default 12)
 * - UNAFFILIATED_POSTS_LIMIT (default 10, capped 10)
 */
async function main() {
  const now = new Date();
  const siteKey = process.env.SITE_KEY ?? 'trendsinusa';

  const auto = String(process.env.UNAFFILIATED_PUBLISHER_AUTO_ENQUEUE ?? 'false').toLowerCase() === 'true';
  if (auto) {
    const minH = Number(process.env.UNAFFILIATED_PUBLISHER_MIN_HOURS ?? 6);
    const maxH = Number(process.env.UNAFFILIATED_PUBLISHER_MAX_HOURS ?? 12);
    const minHours = Number.isFinite(minH) ? Math.max(1, Math.min(48, Math.trunc(minH))) : 6;
    const maxHours = Number.isFinite(maxH) ? Math.max(minHours, Math.min(72, Math.trunc(maxH))) : 12;

    // Deterministic-ish jitter based on current UTC day (no randomness required).
    const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const jitter = (day / (24 * 60 * 60 * 1000)) % (maxHours - minHours + 1);
    const targetHours = minHours + Number(jitter);

    const last = await prisma.systemCommand
      .findFirst({ where: { type: 'UNAFFILIATED_PUBLISHER', siteKey, status: 'SUCCESS' }, orderBy: { processedAt: 'desc' }, select: { processedAt: true } })
      .catch(() => null);
    const lastAt = last?.processedAt?.getTime() ?? 0;
    const hoursSince = lastAt ? (now.getTime() - lastAt) / (60 * 60 * 1000) : Infinity;

    if (hoursSince >= targetHours) {
      await prisma.systemCommand.create({
        data: { type: 'UNAFFILIATED_PUBLISHER', siteKey, status: 'STARTED', metadata: { autoEnqueuedAt: now.toISOString(), targetHours } as any },
      });
    }
  }

  const pending = await prisma.systemCommand.findMany({
    where: { type: 'UNAFFILIATED_PUBLISHER', status: 'STARTED', processedAt: null, siteKey },
    orderBy: { requestedAt: 'asc' },
    take: 2,
  });

  for (const cmd of pending) {
    try {
      const capRaw = Number(process.env.UNAFFILIATED_POSTS_LIMIT ?? 10);
      const cap = Number.isFinite(capRaw) ? Math.max(1, Math.min(10, Math.trunc(capRaw))) : 10;
      const result = await runUnaffiliatedPostGeneration({ limit: cap });
      await prisma.systemCommand.update({
        where: { id: cmd.id },
        data: { processedAt: now, status: 'SUCCESS', metadata: { ...((cmd.metadata as any) ?? {}), result } as any },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.systemCommand.update({ where: { id: cmd.id }, data: { processedAt: now, status: 'FAILURE', error: msg } });
    }
  }
}

void main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error('[unaffiliated-publisher] FAILURE', e);
    process.exitCode = 1;
    await prisma.$disconnect();
  });

