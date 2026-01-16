import { generateHeroImage } from '../ai/visualAssets.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const siteKey = args.find((a) => a.startsWith('--site='))?.split('=')[1] ?? process.env.SITE_KEY ?? 'trendsinusa';
  return { force, siteKey };
}

async function main() {
  const { force, siteKey } = parseArgs();
  const res = await generateHeroImage({ siteKey, force });
  console.log('[ai:hero-image]', res);
}

void main();

