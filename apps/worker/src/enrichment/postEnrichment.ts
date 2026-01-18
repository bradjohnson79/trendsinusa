import sharp from 'sharp';
import { createHash } from 'node:crypto';

import { generateShortText, AI_TEXT_MODEL } from '../ai/openai.js';

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
        // follow redirects so we don't mark 301/302 as dead
        redirect: 'follow',
        signal: ac.signal,
        headers: { accept: 'text/html,*/*' },
      });
      const ok = res.status >= 200 && res.status < 400;
      if (ok) return { status: 'ACTIVE', httpStatus: res.status };
      if (res.status === 404 || res.status === 410) return { status: 'DEAD', httpStatus: res.status };
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

export type OutboundLinkVerification = {
  isActive: boolean;
  status: 'ACTIVE' | 'DEAD' | 'UNKNOWN';
  finalUrl: string | null;
  httpStatus: number | null;
  reason: string;
};

async function verifyLinkWithNano(url: string): Promise<'ACTIVE' | 'INACTIVE' | 'UNKNOWN'> {
  try {
    const raw = await generateShortText({
      model: AI_TEXT_MODEL,
      system: 'Return exactly one token: ACTIVE or INACTIVE. No other words.',
      user: `Check whether this product page is currently active and purchasable. Return ACTIVE or INACTIVE only.\nURL: ${url}`,
      temperature: 0,
      maxOutputTokens: 6,
    });
    const t = raw.trim().toUpperCase();
    if (t.includes('ACTIVE') && !t.includes('INACTIVE')) return 'ACTIVE';
    if (t.includes('INACTIVE')) return 'INACTIVE';
    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

function looksLikeSearchOrHomepage(finalUrl: string): boolean {
  try {
    const u = new URL(finalUrl);
    const p = u.pathname || '/';
    if (p === '/' || p === '') return true;
    const q = (u.search || '').toLowerCase();
    const path = p.toLowerCase();
    if (path.includes('/search')) return true;
    if (q.includes('search=')) return true;
    if (q.includes('q=')) return true;
    // Amazon common search pattern: /s?k=...
    if (path === '/s' && q.includes('k=')) return true;
    return false;
  } catch {
    return false;
  }
}

function containsUnavailableSignals(htmlLower: string): boolean {
  // NOTE: "out of stock" is treated as inactive by default (fail-closed).
  const bad = [
    'currently unavailable',
    'no longer available',
    'this item is no longer available',
    'page not found',
    'not available',
    'out of stock',
  ];
  return bad.some((s) => htmlLower.includes(s));
}

async function fetchTextBestEffort(url: string, timeoutMs: number): Promise<{ status: number | null; finalUrl: string | null; text: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ac.signal, headers: { accept: 'text/html,*/*' } });
    const finalUrl = res.url || null;
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!ct.includes('text/html')) {
      return { status: res.status, finalUrl, text: '' };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const limited = buf.subarray(0, Math.min(buf.length, 200_000)).toString('utf8');
    return { status: res.status, finalUrl, text: limited };
  } catch {
    return { status: null, finalUrl: null, text: '' };
  } finally {
    clearTimeout(t);
  }
}

export async function verifyOutboundLink(url: string): Promise<OutboundLinkVerification> {
  const timeoutMs = 5000;

  const head = await verifyLink(url);
  if (head.status === 'DEAD') {
    return { isActive: false, status: 'DEAD', finalUrl: null, httpStatus: head.httpStatus, reason: 'dead_http' };
  }

  const page = await fetchTextBestEffort(url, timeoutMs);
  const finalUrl = page.finalUrl;
  if (finalUrl && looksLikeSearchOrHomepage(finalUrl)) {
    return { isActive: false, status: 'DEAD', finalUrl, httpStatus: page.status, reason: 'redirect_to_search_or_home' };
  }

  const htmlLower = (page.text || '').toLowerCase();
  if (htmlLower && containsUnavailableSignals(htmlLower)) {
    return { isActive: false, status: 'DEAD', finalUrl, httpStatus: page.status, reason: 'unavailable_text' };
  }

  if (head.status === 'ACTIVE') {
    return { isActive: true, status: 'ACTIVE', finalUrl, httpStatus: head.httpStatus, reason: 'ok' };
  }

  // Edge-case AI verification only when HTTP checks are inconclusive.
  const nano = await verifyLinkWithNano(url);
  if (nano === 'ACTIVE') {
    return { isActive: true, status: 'ACTIVE', finalUrl, httpStatus: head.httpStatus, reason: 'nano_active' };
  }
  if (nano === 'INACTIVE') {
    return { isActive: false, status: 'DEAD', finalUrl, httpStatus: head.httpStatus, reason: 'nano_inactive' };
  }

  return { isActive: false, status: 'UNKNOWN', finalUrl, httpStatus: head.httpStatus, reason: 'unknown' };
}

function norm(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function sha(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function bgToneForCategory(category: string | null, mode: 'thumb' | 'hero') {
  const c = norm(category || 'general');
  if (mode === 'thumb') return '#ffffff';
  if (c.includes('elect')) return '#f3f6ff';
  if (c.includes('kitchen')) return '#f7f2ea';
  if (c.includes('home')) return '#f2f7f2';
  if (c.includes('fitness') || c.includes('sport')) return '#f1f5f9';
  return '#f5f5f5';
}

function iconForCategory(category: string | null) {
  const c = norm(category || 'general');
  if (c.includes('elect')) {
    // monitor
    return `<rect x="92" y="116" width="216" height="144" rx="18" />\n<path d="M140 294h120" />`;
  }
  if (c.includes('kitchen')) {
    // pot
    return `<path d="M126 166h148" />\n<path d="M140 166v92c0 18 16 32 36 32h88c20 0 36-14 36-32v-92" />\n<path d="M166 166c0-18 16-32 36-32h40c20 0 36 14 36 32" />`;
  }
  if (c.includes('home')) {
    // home
    return `<path d="M120 214l80-70 80 70" />\n<path d="M140 206v120h120V206" />`;
  }
  if (c.includes('fitness') || c.includes('sport')) {
    // dumbbell
    return `<path d="M124 236h152" />\n<path d="M110 210v52" />\n<path d="M290 210v52" />\n<path d="M96 218v36" />\n<path d="M304 218v36" />`;
  }
  // generic glyph
  return `<path d="M140 236c0-46 34-84 76-84s76 38 76 84-34 84-76 84-76-38-76-84z"/>\n<path d="M156 332h120" />`;
}

function svgThumb(params: { category: string | null }) {
  // Pure white background + neutral gray icon.
  const bg = '#ffffff';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <rect x="0" y="0" width="150" height="150" fill="${bg}"/>
  <rect x="16" y="16" width="118" height="118" rx="18" fill="#f3f4f6" stroke="#d1d5db"/>
  <g fill="none" stroke="#6b7280" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="translate(-85,-85) scale(0.5)">
    ${iconForCategory(params.category)}
  </g>
</svg>`;
}

function svgHero(params: { category: string | null }) {
  // Subtle tinted background by category; still neutral.
  const bg = bgToneForCategory(params.category, 'hero');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect x="0" y="0" width="400" height="400" fill="${bg}"/>
  <rect x="36" y="36" width="328" height="328" rx="28" fill="#ffffff" opacity="0.70"/>
  <g fill="none" stroke="#475569" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    ${iconForCategory(params.category)}
  </g>
</svg>`;
}

async function svgToDataUrl(svg: string, size: { w: number; h: number }, format: 'png' | 'webp'): Promise<string> {
  const buf = await sharp(Buffer.from(svg))
    .resize(size.w, size.h, { fit: 'cover', position: 'attention' })
    .toFormat(format, format === 'png' ? { compressionLevel: 9 } : { quality: 84 })
    .toBuffer();
  const mime = format === 'png' ? 'image/png' : 'image/webp';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export async function generateThumbnailDataUrl(params: {
  title: string;
  category: string | null;
  confidenceScore: number | null;
}): Promise<{ url: string; source: 'procedural'; inputHash: string }> {
  const inputHash = sha(`thumb:v1:${norm(params.title)}|${norm(params.category || '')}|conf=${params.confidenceScore ?? 'null'}`);
  const url = await svgToDataUrl(svgThumb({ category: params.category }), { w: 150, h: 150 }, 'png');
  return { url, source: 'procedural', inputHash };
}

export async function generateHeroImageDataUrl(params: {
  title: string;
  category: string | null;
  confidenceScore: number | null;
}): Promise<{ url: string; source: 'procedural'; inputHash: string }> {
  const inputHash = sha(`hero:v1:${norm(params.title)}|${norm(params.category || '')}|conf=${params.confidenceScore ?? 'null'}`);
  const url = await svgToDataUrl(svgHero({ category: params.category }), { w: 400, h: 400 }, 'webp');
  return { url, source: 'procedural', inputHash };
}

function normalizeOneSentence(s: string) {
  return String(s || '').replace(/\s+/g, ' ').replace(/^[-•\u2022]\s*/g, '').trim();
}

export function clampWords(s: string, maxWords: number) {
  const words = normalizeOneSentence(s).split(' ').filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

export async function generateShortDescription(params: { title: string; category: string; retailer: string }): Promise<string | null> {
  try {
    const raw = await generateShortText({
      model: AI_TEXT_MODEL,
      system: 'Return ONE neutral sentence. No marketing. No pricing. Max 20 words.',
      user: `Product: "${params.title}"\nCategory: "${params.category}"\nRetailer: "${params.retailer}"`,
      temperature: 0,
      maxOutputTokens: 60,
    });
    const one = clampWords(raw, 20);
    return one || null;
  } catch {
    return null;
  }
}

export async function generateWhyTrending(params: { title: string; category: string; retailer: string }): Promise<string | null> {
  try {
    const raw = await generateShortText({
      model: AI_TEXT_MODEL,
      system: 'Return ONE neutral sentence explaining why it might be trending. No marketing. Max 20 words.',
      user: `Product: "${params.title}"\nCategory: "${params.category}"\nRetailer: "${params.retailer}"`,
      temperature: 0,
      maxOutputTokens: 60,
    });
    const one = clampWords(raw, 20);
    return one || null;
  } catch {
    return null;
  }
}

export async function scoreConfidenceNano(params: { title: string; category: string; retailer: string }): Promise<number | null> {
  try {
    const raw = await generateShortText({
      model: AI_TEXT_MODEL,
      system: 'Return only a number between 0 and 1 (inclusive). No other text.',
      user: `Score confidence that this is a current, relevant product listing.\nProduct: "${params.title}"\nCategory: "${params.category}"\nRetailer: "${params.retailer}"`,
      temperature: 0,
      maxOutputTokens: 12,
    });
    const m = raw.trim().match(/(0(\.\d+)?|1(\.0+)?)/);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(1, n));
  } catch {
    return null;
  }
}
