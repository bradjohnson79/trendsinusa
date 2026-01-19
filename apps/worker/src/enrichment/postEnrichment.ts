import sharp from 'sharp';

import { generatePromoImage, generateShortText } from '../ai/openai.js';

export type LinkCheckResult = {
  status: 'ACTIVE' | 'DEAD' | 'UNKNOWN';
  httpStatus: number | null;
};

export async function verifyLink(url: string): Promise<LinkCheckResult> {
  const timeoutMs = 5000;

  async function attempt(method: 'HEAD' | 'GET'): Promise<LinkCheckResult> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        // best-effort: follow redirects so we don't mark common 301/302 as dead
        redirect: 'follow',
        signal: ac.signal,
      });
      const ok = res.status >= 200 && res.status < 400;
      if (ok) return { status: 'ACTIVE', httpStatus: res.status };
      if (res.status === 404 || res.status === 410) return { status: 'DEAD', httpStatus: res.status };
      // Other 4xx/5xx are treated as unknown (transient).
      return { status: 'UNKNOWN', httpStatus: res.status };
    } catch {
      return { status: 'UNKNOWN', httpStatus: null };
    } finally {
      clearTimeout(t);
    }
  }

  const head = await attempt('HEAD');
  if (head.status !== 'UNKNOWN') return head;
  return await attempt('GET');
}

function encodeSvgDataUrl(svg: string) {
  // Keep it safe for attribute usage and stable across browsers.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function fallbackThumbnailSvg(params: { title: string; category: string | null }) {
  const cat = (params.category || 'General').toLowerCase();
  // Minimal, neutral icon (no logos, no brands, no text).
  // White background, gray palette, 150x150.
  const icon = (() => {
    if (cat.includes('elect')) {
      // monitor
      return `<rect x="46" y="50" width="58" height="38" rx="6" />
              <path d="M62 98h26" />`;
    }
    if (cat.includes('kitchen') || cat.includes('home')) {
      // home
      return `<path d="M52 78l23-20 23 20" />
              <path d="M58 74v28h34V74" />`;
    }
    if (cat.includes('fitness') || cat.includes('sport')) {
      // dumbbell
      return `<path d="M52 78h46" />
              <path d="M48 70v16" />
              <path d="M102 70v16" />
              <path d="M42 72v12" />
              <path d="M108 72v12" />`;
    }
    // generic product glyph
    return `<path d="M52 72c0-14 10-26 23-26s23 12 23 26-10 26-23 26-23-12-23-26z"/>
            <path d="M58 102h34"/>`;
  })();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <rect x="0" y="0" width="150" height="150" fill="#ffffff"/>
  <rect x="18" y="18" width="114" height="114" rx="18" fill="#f3f4f6" stroke="#d1d5db"/>
  <g fill="none" stroke="#6b7280" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${icon}
  </g>
</svg>`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function generateThumbnailDataUrl(params: { title: string; category: string | null }): Promise<{ url: string; source: 'ai' | 'fallback' }> {
  // Try OpenAI image generation (if available), then downscale to 150x150 and force white background.
  // If anything fails, return fallback SVG.
  try {
    const model = process.env.AI_IMAGE_MODEL ?? 'dall-e-3';
    const prompt = `Create a clean, realistic product image suitable for a shopping website thumbnail.

Product name: \"${params.title}\"
Category: \"${params.category ?? 'General'}\"

Style requirements:
- plain white background
- realistic product appearance
- no logos, no branding, no text
- centered composition
- soft studio lighting
- square format`;

    const url = await generatePromoImage({ model, prompt, size: '1024x1024' });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`image_download_failed:${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const thumb = await sharp(buf)
      .resize(150, 150, { fit: 'cover', position: 'attention' })
      .flatten({ background: '#ffffff' })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return { url: `data:image/png;base64,${thumb.toString('base64')}`, source: 'ai' };
  } catch {
    const svg = fallbackThumbnailSvg({ title: params.title, category: params.category });
    return { url: encodeSvgDataUrl(svg), source: 'fallback' };
  }
}

function normalizeOneSentence(s: string) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/^[-•\u2022]\s*/g, '')
    .trim();
}

export function clampWords(s: string, maxWords: number) {
  const words = normalizeOneSentence(s).split(' ').filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

function extractWhatItIsSummaryMarkdown(md: string): string {
  // Best-effort: grab the first paragraph under "## What it is".
  const lines = String(md || '').split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().toLowerCase() === '## what it is');
  if (idx === -1) return '';
  const out: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (!t) continue;
    if (t.startsWith('## ')) break;
    if (t.startsWith('- ')) continue;
    out.push(t);
    if (out.join(' ').length >= 220) break;
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

export async function generateHeroImageDataUrl(params: {
  title: string;
  category: string | null;
  context: string | null;
}): Promise<{ url: string; source: 'ai' | 'placeholder' } | null> {
  // AI-only (no scraping). If generation fails, return null and keep placeholder.
  try {
    const model = process.env.AI_IMAGE_MODEL ?? 'dall-e-3';
    const context = (params.context || '').trim();
    const prompt = `Create a realistic, editorial-style product image suitable for a blog post.

Product: "${params.title}"
Category: "${params.category ?? 'General'}"
Context: "${context || 'Informational product overview.'}"

Style guidelines:
- realistic product appearance
- clean, neutral environment (light interior, tabletop, lifestyle scene)
- soft natural lighting
- no logos, no text, no branding, no watermarks
- centered subject
- square format`;

    const url = await generatePromoImage({ model, prompt, size: '1024x1024' });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`image_download_failed:${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const hero = await sharp(buf)
      .resize(400, 400, { fit: 'cover', position: 'attention' })
      // ensure no transparency edge cases; use a neutral light background (not pure white)
      .flatten({ background: '#f5f5f5' })
      .webp({ quality: 84 })
      .toBuffer();

    return { url: `data:image/webp;base64,${hero.toString('base64')}`, source: 'ai' };
  } catch {
    return null;
  }
}

export async function generateShortDescription(params: { title: string; category: string; retailer: string }): Promise<string | null> {
  try {
    const raw = await generateShortText({
      model: process.env.AI_REVIEW_MODEL || process.env.AI_FINAL_MODEL || 'gpt-4.1-mini',
      system: 'You write neutral, factual product descriptions. No marketing, no pricing, no affiliate language.',
      user: `Write ONE neutral sentence describing the product below.

Rules:
- factual tone
- no marketing language
- no pricing
- no affiliate language
- max 20 words

Product: \"${params.title}\"
Category: \"${params.category}\"
Retailer: \"${params.retailer}\"`,
      temperature: 0,
      maxOutputTokens: 60,
    });
    const one = clampWords(raw, 20);
    if (!one) return null;
    return one;
  } catch {
    return null;
  }
}

export function deriveHeroContextFromPost(params: { body: string; summary: string; shortDescription: string | null }) {
  const fromWhat = extractWhatItIsSummaryMarkdown(params.body);
  if (fromWhat) return fromWhat;
  if (params.shortDescription) return params.shortDescription;
  const fromSummary = String(params.summary || '').split(/[.!?]\s/)[0]?.trim() ?? '';
  return fromSummary || '';
}
