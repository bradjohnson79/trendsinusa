import { generateCategoryImages } from '../ai/visualAssets.js';

async function main() {
  const res = await generateCategoryImages();
  // eslint-disable-next-line no-console
  console.log('[ai:category-images]', res);
}

void main();
