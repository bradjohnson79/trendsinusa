import { runDailyBannerTextWriterAndImage, runDailyDealMicroCopyWriter, runDailyHeroHeadlineWriter } from '../ai/daily.js';
import { runBatchRegenerateStaleProducts } from '../ai/productCopy.js';

/**
 * Cron-compatible daily runner.
 * One-shot: exit 0/1.
 */
async function main() {
  try {
    const hero = await runDailyHeroHeadlineWriter();
    const banners = await runDailyBannerTextWriterAndImage();
    const deals = await runDailyDealMicroCopyWriter();
    const products = await runBatchRegenerateStaleProducts({ limit: 10 });

    // eslint-disable-next-line no-console
    console.log('[daily] SUCCESS', {
      hero,
      bannersUpdated: banners.length,
      dealsUpdated: deals.length,
      productsUpdated: products.filter((p) => p.ok && !p.skipped).length,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[daily] FAILURE', e);
    process.exitCode = 1;
  }
}

void main();

