import { prisma } from '@trendsinusa/db';

import { fetchSeedIngestionPayload } from '../ingestion/sources/seed.js';
import { runIngestion } from '../ingestion/pipeline.js';
import { expireDealsSweep, reEvaluateDealStates } from '../maintenance/deals.js';
import { runAmazonProductIngestion } from '../jobs/amazonProducts.js';
import { runAmazonDealDetection } from '../jobs/amazonDeals.js';
import { runDiscoverySweep } from '../jobs/discoverySweep.js';
import { runUnaffiliatedPostGeneration } from '../jobs/unaffiliatedPosts.js';

import { requireIngestionEnabled } from '../ingestion/gate.js';

function parseCsvEnv(key: string): string[] {
  const raw = process.env[key] ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function processSystemCommands(now: Date) {
  const pending = await prisma.systemCommand.findMany({
    where: { status: 'STARTED', processedAt: null },
    orderBy: { requestedAt: 'asc' },
    take: 5,
  });

  const asins = parseCsvEnv('AMAZON_INGEST_ASINS');
  const keywords = parseCsvEnv('AMAZON_INGEST_KEYWORDS');
  const limitPerKeyword = Number(process.env.AMAZON_INGEST_LIMIT || 10);

  for (const cmd of pending) {
    try {
      let result: unknown = null;
      if (cmd.type === 'AMAZON_PRODUCTS_REFRESH') {
        result = await runAmazonProductIngestion({ asins, keywords, limitPerKeyword: Number.isFinite(limitPerKeyword) ? limitPerKeyword : 10, source: 'AMAZON_DEAL' });
      } else if (cmd.type === 'AMAZON_DEALS_REFRESH') {
        result = await runAmazonDealDetection({ asins, keywords, limitPerKeyword: Number.isFinite(limitPerKeyword) ? limitPerKeyword : 10, source: 'AMAZON_DEAL', provider: 'AMAZON' });
      } else if (cmd.type === 'DISCOVERY_SWEEP') {
        result = await runDiscoverySweep({ siteKey: cmd.siteKey });
      } else if (cmd.type === 'UNAFFILIATED_PUBLISHER') {
        const capRaw = Number(process.env.UNAFFILIATED_POSTS_LIMIT ?? 10);
        const cap = Number.isFinite(capRaw) ? Math.max(1, Math.min(10, Math.trunc(capRaw))) : 10;
        result = await runUnaffiliatedPostGeneration({ limit: cap });
      }

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
 * Cron-compatible hourly runner.
 * Intentionally one-shot (exit 0/1) so it can be invoked by system cron, GitHub Actions, etc.
 *
 * NOTE: Uses existing `IngestionRun` table for logging via `metadata` (no schema changes).
 */
async function main() {
  const startedAt = new Date();
  const run = await prisma.ingestionRun.create({
    data: {
      source: 'MANUAL',
      status: 'STARTED',
      startedAt,
      metadata: { runType: 'hourly', tasks: ['ingestion_refresh', 'expiration_sweep', 'state_reeval'] },
    },
  });

  try {
    const now = new Date();
    // 0) Admin-triggered refreshes (fail-closed: if env inputs are missing, command will fail with error logged).
    await processSystemCommands(now);

    // Global kill switch: prevent accidental ingestion runs.
    await requireIngestionEnabled({ siteKey: 'trendsinusa' });

    // 1) Hourly ingestion refresh (seed source for now)
    const payload = await fetchSeedIngestionPayload();
    const ingestionRes = await runIngestion({ source: 'MANUAL', payload });

    // 2) Expiration sweep
    const expireRes = await expireDealsSweep(now);

    // 3) State re-evaluation (bucketize)
    const reevalRes = await reEvaluateDealStates(now);

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        productsProcessed: ingestionRes.productsProcessed,
        dealsProcessed: ingestionRes.dealsProcessed,
        metadata: {
          runType: 'hourly',
          tasks: ['ingestion_refresh', 'expiration_sweep', 'state_reeval'],
          ingestion: ingestionRes,
          expired: expireRes,
          reeval: reevalRes,
        },
      },
    });

    // eslint-disable-next-line no-console
    console.log('[hourly] SUCCESS', {
      ingestion: ingestionRes,
      expired: expireRes,
      reeval: reevalRes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILURE',
        finishedAt: new Date(),
        error: message,
      },
    });
    // eslint-disable-next-line no-console
    console.error('[hourly] FAILURE', e);
    process.exitCode = 1;
  }
}

void main();

