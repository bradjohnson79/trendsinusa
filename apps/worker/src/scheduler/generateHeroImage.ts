import { generateHeroImage } from '../ai/visualAssets.js';

async function main() {
  const res = await generateHeroImage();
  // eslint-disable-next-line no-console
  console.log('[ai:hero-image]', res);
}

void main();
