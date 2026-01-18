import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import type { ImageVariantSpec } from './types.js';

export type ProcessedVariant = {
  key: string;
  width: number;
  height: number;
  filename: string;
  relativePath: string;
};

function assetsRootDirFromWorkerCwd() {
  // scripts run from apps/worker, so ../web/public is stable.
  return path.resolve(process.cwd(), '..', 'web', 'public', 'assets', 'generated');
}

export async function writeVariantsWebp(params: {
  master: Buffer;
  outDirParts: string[];
  variants: ImageVariantSpec[];
}): Promise<{ outDirAbs: string; variants: ProcessedVariant[] }> {
  const outDirAbs = path.join(assetsRootDirFromWorkerCwd(), ...params.outDirParts);
  await mkdir(outDirAbs, { recursive: true });

  const variants: ProcessedVariant[] = [];
  for (const v of params.variants) {
    // webp default; do NOT call withMetadata() => strips metadata by default
    const buf = await sharp(params.master)
      .resize(v.width, v.height, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();

    const filename = `${v.key}-${v.width}x${v.height}.webp`;
    const abs = path.join(outDirAbs, filename);
    await writeFile(abs, buf);

    const relativePath = path.posix.join('/assets/generated', ...params.outDirParts.map(encodeURIComponent), filename);
    variants.push({ key: v.key, width: v.width, height: v.height, filename, relativePath });
  }

  return { outDirAbs, variants };
}

