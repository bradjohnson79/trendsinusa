import { prisma } from '@trendsinusa/db';
import { getServerEnv } from '@trendsinusa/shared';
import { runProductEnrichmentForAsin } from '../ai/productEnrichment.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const asin = args.find((a) => a.startsWith('--asin='))?.slice('--asin='.length) ?? '';
  const force = args.includes('--force');
  return { asin: asin.trim(), force };
}

/**
 * Cron-ready runner for product enrichment.
 * Permanent policy: no batch long-form generation.
 *
 * Only supports single-product enrichment via --asin=.
 */
async function main() {
  void getServerEnv();

  const startedAt = new Date();
  const { asin, force } = parseArgs();

  const run = await prisma.ingestionRun.create({
    data: {
      source: 'MANUAL',
      status: 'STARTED',
      startedAt,
      metadata: { runType: 'product_ai_enrichment', asin: asin || null, force },
    },
  });

  try {
    if (!asin) {
      const result = { ok: true as const, skipped: true as const, reason: 'batch_disabled_by_policy' };
      await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: 'SUCCESS', finishedAt: new Date(), metadata: { ...(run.metadata as any), result } } });
      // eslint-disable-next-line no-console
      console.log('[ai:product-enrichment] SKIPPED', result);
      return;
    }

    const result = await runProductEnrichmentForAsin({ asin, manualOverride: false, force });

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        productsProcessed: 1,
        metadata: { ...((run.metadata as any) ?? {}), result },
      },
    });

    // eslint-disable-next-line no-console
    console.log('[ai:product-enrichment] SUCCESS', result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: 'FAILURE', finishedAt: new Date(), error: message } });
    // eslint-disable-next-line no-console
    console.error('[ai:product-enrichment] FAILURE', e);
    process.exitCode = 1;
  }
}

void main();
