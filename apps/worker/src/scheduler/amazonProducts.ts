import { prisma } from '@trendsinusa/db';
import { getServerEnv } from '@trendsinusa/shared';
import { runAmazonProductIngestion } from '../jobs/amazonProducts.js';

function parseCsvEnv(key: string): string[] {
  const raw = process.env[key] ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs(): { asins: string[]; keywords: string[]; limitPerKeyword: number } {
  const asinsArg = process.argv.find((a) => a.startsWith('--asins='))?.slice('--asins='.length) ?? '';
  const keywordsArg = process.argv.find((a) => a.startsWith('--keywords='))?.slice('--keywords='.length) ?? '';
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) ?? '';

  const asins = asinsArg ? asinsArg.split(',').map((s) => s.trim()).filter(Boolean) : parseCsvEnv('AMAZON_INGEST_ASINS');
  const keywords = keywordsArg
    ? keywordsArg.split(',').map((s) => s.trim()).filter(Boolean)
    : parseCsvEnv('AMAZON_INGEST_KEYWORDS');

  const limitPerKeyword = Number(limitArg || process.env.AMAZON_INGEST_LIMIT || 10);
  return { asins, keywords, limitPerKeyword: Number.isFinite(limitPerKeyword) ? limitPerKeyword : 10 };
}

/**
 * Cron-compatible Amazon product ingestion runner.
 * One-shot: exit 0/1.
 *
 * Seed inputs:
 * - ASIN list (env AMAZON_INGEST_ASINS or --asins=...)
 * - Category keywords (env AMAZON_INGEST_KEYWORDS or --keywords=...)
 *
 * Writes ingestion metadata to IngestionRun. No deals are created.
 */
async function main() {
  // Ensure env is parsed (also validates DATABASE_URL, etc).
  void getServerEnv();

  const startedAt = new Date();
  const { asins, keywords, limitPerKeyword } = parseArgs();

  const run = await prisma.ingestionRun.create({
    data: {
      source: 'AMAZON_DEAL',
      status: 'STARTED',
      startedAt,
      metadata: { runType: 'amazon_products', asins, keywords, limitPerKeyword },
    },
  });

  try {
    const res = await runAmazonProductIngestion({ asins, keywords, limitPerKeyword, source: 'AMAZON_DEAL' });

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        productsProcessed: res.productsUpserted,
        dealsProcessed: 0,
        metadata: { ...((run.metadata as any) ?? {}), result: res },
      },
    });

    // eslint-disable-next-line no-console
    console.log('[amazon-products] SUCCESS', res);
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
    console.error('[amazon-products] FAILURE', e);
    process.exitCode = 1;
  }
}

void main();

