import { runListingImageRetry } from '../jobs/listingImageRetry.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const limitRaw = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  return { limit };
}

async function main() {
  const { limit } = parseArgs();
  const res = await runListingImageRetry({ ...(limit != null ? { limit } : {}) });
  // eslint-disable-next-line no-console
  console.log('[listing-image-retry]', res);
}

void main();

