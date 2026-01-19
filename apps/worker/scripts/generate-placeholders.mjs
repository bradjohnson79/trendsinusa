import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve from apps/worker/scripts/ → repo root.
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC_DIR = path.resolve(ROOT, 'assets', 'placeholders');
const OUT_DIR = path.resolve(ROOT, 'apps', 'web', 'public', 'placeholders');

const SIZE = 256;

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function listSvgs() {
  const all = await fs.readdir(SRC_DIR);
  return all.filter((f) => f.endsWith('.svg'));
}

async function renderOne(svgFile) {
  const base = svgFile.replace(/\.svg$/i, '');
  const inAbs = path.join(SRC_DIR, svgFile);
  const outAbs = path.join(OUT_DIR, `${base}.png`);

  const svg = await fs.readFile(inAbs);
  const buf = await sharp(svg, { density: 192 })
    .resize(SIZE, SIZE, { fit: 'cover', withoutEnlargement: true })
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();

  await fs.writeFile(outAbs, buf);
  return { inAbs, outAbs };
}

async function main() {
  await ensureDir(OUT_DIR);
  const svgs = await listSvgs();
  if (svgs.length === 0) throw new Error(`No SVGs found in ${SRC_DIR}`);

  const results = [];
  for (const f of svgs) results.push(await renderOne(f));

  // eslint-disable-next-line no-console
  console.log(`[placeholders] wrote ${results.length} png(s) to ${OUT_DIR}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[placeholders] FAILED', e);
  process.exitCode = 1;
});

