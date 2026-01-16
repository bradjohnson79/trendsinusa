import { prisma } from '@trendsinusa/db';
import { getServerEnv } from '@trendsinusa/shared';
import { runProductEnrichmentBatch, runProductEnrichmentForAsin } from '../ai/productEnrichment.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const asin = args.find((a) => a.startsWith('--asin='))?.slice('--asin='.length) ?? '';
  const limitRaw = args.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) ?? '';
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 25;
  const force = args.includes('--force');
  return { asin: asin.trim(), limit: Number.isFinite(limit) ? limit : 25, force };
}

/**
 * Cron-ready runner for product AI enrichment.
 * - If --asin= is provided, enrich a single product.
 * - Otherwise enrich a batch (default limit=25).
 *
 * Output is stored in ProductAIEnrichment only (never overwrites source Product fields).
 */
async function main() {
  void getServerEnv();

  const startedAt = new Date();
  const { asin, limit, force } = parseArgs();

  const run = await prisma.ingestionRun.create({
    data: {
      source: 'MANUAL',
      status: 'STARTED',
      startedAt,
      metadata: { runType: 'product_ai_enrichment', asin: asin || null, limit, force },
    },
  });

  try {
    const result = asin
      ? await runProductEnrichmentForAsin({ asin, manualOverride: false, force })
      : await runProductEnrichmentBatch({ limit });

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        productsProcessed: asin ? 1 : limit,
        metadata: { ...((run.metadata as any) ?? {}), result },
      },
    });

    // eslint-disable-next-line no-console
    console.log('[ai:product-enrichment] SUCCESS', result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: 'FAILURE', finishedAt: new Date(), error: message },
    });
    // eslint-disable-next-line no-console
    console.error('[ai:product-enrichment] FAILURE', e);
    process.exitCode = 1;
  }
}

void main();

