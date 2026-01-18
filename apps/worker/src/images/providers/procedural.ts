import sharp from 'sharp';

import type { ImageProvider, ImageProviderGenerateOptions } from '../provider.js';

function mulberry32(seed: number) {
  // Small deterministic PRNG
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashToSeed(s: string): number {
  // Deterministic 32-bit hash (FNV-1a-ish)
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dimsFor(size: ImageProviderGenerateOptions['size']): { w: number; h: number } {
  if (size === '1792x1024') return { w: 1792, h: 1024 };
  if (size === '1024x1792') return { w: 1024, h: 1792 };
  return { w: 1024, h: 1024 };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

function buildAbstractSvg(params: { prompt: string; w: number; h: number }) {
  const seed = hashToSeed(params.prompt);
  const rand = mulberry32(seed);

  // Neutral, “product-style” palette (no flags, no brands)
  const baseHue = rand() * 360;
  const accentHue = (baseHue + 30 + rand() * 60) % 360;

  const bg1 = hsl(baseHue, 18 + rand() * 10, 95 - rand() * 6);
  const bg2 = hsl((baseHue + 10) % 360, 22 + rand() * 10, 90 - rand() * 8);
  const accent1 = hsl(accentHue, 40 + rand() * 25, 55 + rand() * 10);
  const accent2 = hsl((accentHue + 40) % 360, 35 + rand() * 25, 45 + rand() * 12);

  const blobs = Array.from({ length: 9 }).map((_, i) => {
    const cx = rand() * params.w;
    const cy = rand() * params.h;
    const rx = clamp(params.w * (0.08 + rand() * 0.22), 60, params.w);
    const ry = clamp(params.h * (0.08 + rand() * 0.22), 60, params.h);
    const rot = rand() * 360;
    const alpha = 0.10 + rand() * 0.22;
    const fill = i % 2 === 0 ? accent1 : accent2;
    return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(
      1,
    )}" fill="${fill}" opacity="${alpha.toFixed(3)}" transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" />`;
  });

  // Subtle “studio vignette”
  const vignette = `
    <radialGradient id="vig" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.00"/>
      <stop offset="70%" stop-color="#000" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.14"/>
    </radialGradient>
    <rect x="0" y="0" width="${params.w}" height="${params.h}" fill="url(#vig)" />
  `.trim();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${params.w}" height="${params.h}" viewBox="0 0 ${params.w} ${params.h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <filter id="blurSoft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${(6 + rand() * 10).toFixed(1)}" />
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${params.w}" height="${params.h}" fill="url(#bg)" />

  <!-- Abstract blobs (no text, no logos) -->
  <g filter="url(#blurSoft)">
    ${blobs.join('\n    ')}
  </g>

  ${vignette}
</svg>`;
}

export class ProceduralImageProvider implements ImageProvider {
  async generate(opts: ImageProviderGenerateOptions): Promise<Buffer> {
    const { w, h } = dimsFor(opts.size);
    const svg = buildAbstractSvg({ prompt: opts.prompt, w, h });

    // Render to PNG in-memory (Sharp can decode this reliably later).
    return await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  }
}

