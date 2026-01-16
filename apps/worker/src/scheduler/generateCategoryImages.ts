import { generateCategoryImages } from '../ai/visualAssets.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const siteKey = args.find((a) => a.startsWith('--site='))?.split('=')[1] ?? process.env.SITE_KEY ?? 'trendsinusa';
  const limitRaw = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  return { force, siteKey, limit };
}

async function main() {
  const { force, siteKey, limit } = parseArgs();
  const res = await generateCategoryImages({ siteKey, force, ...(limit != null ? { limit } : {}) });
  console.log('[ai:category-images]', res);
}

void main();

