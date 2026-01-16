import { prisma } from '@trendsinusa/db';
import { getServerEnv } from '@trendsinusa/shared';
import { runAmazonDealDetection } from '../jobs/amazonDeals.js';

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
 * Cron-compatible Amazon deal detection runner.
 *
 * A Deal is created only when:
 * - current price < historical reference (max observed last 30d), OR
 * - Amazon flags it as a promotion (best-effort via Offers.*)
 *
 * Never fabricates discounts: oldPrice/discount only come from historical reference.
 */
async function main() {
  void getServerEnv();

  const startedAt = new Date();
  const { asins, keywords, limitPerKeyword } = parseArgs();

  const run = await prisma.ingestionRun.create({
    data: {
      source: 'AMAZON_DEAL',
      status: 'STARTED',
      startedAt,
      metadata: { runType: 'amazon_deal_detection', asins, keywords, limitPerKeyword },
    },
  });

  try {
    const res = await runAmazonDealDetection({ asins, keywords, limitPerKeyword, source: 'AMAZON_DEAL', provider: 'AMAZON' });

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        productsProcessed: res.evaluated,
        dealsProcessed: res.dealsUpserted,
        metadata: { ...((run.metadata as any) ?? {}), result: res },
      },
    });

    // eslint-disable-next-line no-console
    console.log('[amazon-deals] SUCCESS', res);
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
    console.error('[amazon-deals] FAILURE', e);
    process.exitCode = 1;
  }
}

void main();

