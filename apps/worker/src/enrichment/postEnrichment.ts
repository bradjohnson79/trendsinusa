import sharp from 'sharp';
import { createHash } from 'node:crypto';

import { AI_TEXT_MODEL, generateShortText } from '../ai/openai.js';

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

function looksLikeSearchOrHomepage(finalUrl: string): boolean {
  try {
    const u = new URL(finalUrl);
    const p = (u.pathname || '/').toLowerCase();
    const q = (u.search || '').toLowerCase();
    if (p === '/' || p === '') return true;
    if (p.includes('/search')) return true;
    if (p === '/s' && q.includes('k=')) return true;
    if (q.includes('search=')) return true;
    if (q.includes('q=')) return true;
    return false;
  } catch {
    return false;
  }
}

function containsUnavailableSignals(htmlLower: string): boolean {
  const bad = [
    'currently unavailable',
    'no longer available',
    'this item is no longer available',
    'page not found',
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
    if (!ct.includes('text/html')) return { status: res.status, finalUrl, text: '' };
    const buf = Buffer.from(await res.arrayBuffer());
    const limited = buf.subarray(0, Math.min(buf.length, 200_000)).toString('utf8');
    return { status: res.status, finalUrl, text: limited };
  } catch {
    return { status: null, finalUrl: null, text: '' };
  } finally {
    clearTimeout(t);
  }
}

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
    if (t.includes('INACTIVE')) return 'INACTIVE';
    if (t.includes('ACTIVE')) return 'ACTIVE';
    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
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
  if (nano === 'ACTIVE') return { isActive: true, status: 'ACTIVE', finalUrl, httpStatus: head.httpStatus, reason: 'nano_active' };
  if (nano === 'INACTIVE') return { isActive: false, status: 'DEAD', finalUrl, httpStatus: head.httpStatus, reason: 'nano_inactive' };

  return { isActive: false, status: 'UNKNOWN', finalUrl, httpStatus: head.httpStatus, reason: 'unknown' };
}

function norm(s: string) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function sha(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function seeded01(hex: string, offset: number) {
  const slice = hex.slice(offset, offset + 8);
  const n = Number.parseInt(slice || '0', 16);
  return (n % 10_000) / 10_000;
}

function bgToneForCategory(category: string | null | undefined) {
  const c = norm(category || '');
  if (c.includes('kitchen')) return ['#fff7ed', '#f1f5f9'];
  if (c.includes('elect')) return ['#eef2ff', '#f1f5f9'];
  if (c.includes('security')) return ['#f1f5f9', '#e2e8f0'];
  if (c.includes('climate') || c.includes('hvac')) return ['#ecfdf5', '#f1f5f9'];
  if (c.includes('home')) return ['#ecfeff', '#f1f5f9'];
  return ['#f8fafc', '#eef2f7'];
}

function productSilhouetteSvg(params: { title: string; category: string | null; shortDescription?: string | null; size: 512 | 400 | 150 }) {
  // Deterministic, product-specific (seeded by title/category/desc), no text overlays.
  const seed = sha(`prodimg:v1:${norm(params.title)}|${norm(params.category || '')}|${norm(params.shortDescription || '')}`);
  const [c0, c1] = bgToneForCategory(params.category);

  const a = seeded01(seed, 0);
  const b = seeded01(seed, 8);
  const c = seeded01(seed, 16);

  const rx = 48;
  const iconX = 140 + Math.floor(a * 40);
  const iconY = 150 + Math.floor(b * 30);
  const w = 220 + Math.floor(c * 60);
  const h = 160 + Math.floor((1 - a) * 70);
  const r = 26 + Math.floor(b * 14);

  // subtle shadow/highlight layers to feel like studio photo
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c0}"/>
      <stop offset="1" stop-color="${c1}"/>
    </linearGradient>
    <clipPath id="r">
      <rect x="0" y="0" width="512" height="512" rx="${rx}" ry="${rx}"/>
    </clipPath>
    <radialGradient id="spot" cx="50%" cy="35%" r="70%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g clip-path="url(#r)">
    <rect width="512" height="512" fill="url(#bg)"/>
    <rect width="512" height="512" fill="url(#spot)"/>
    <ellipse cx="256" cy="392" rx="170" ry="42" fill="#0f172a" opacity="0.10"/>
    <g>
      <rect x="${iconX}" y="${iconY}" width="${w}" height="${h}" rx="${r}" fill="#ffffff" opacity="0.92"/>
      <rect x="${iconX + 10}" y="${iconY + 12}" width="${Math.max(60, w - 26)}" height="${Math.max(30, Math.floor(h * 0.22))}" rx="${Math.max(12, r - 10)}" fill="#e2e8f0" opacity="0.65"/>
      <rect x="${iconX + 18}" y="${iconY + Math.floor(h * 0.45)}" width="${Math.max(80, Math.floor(w * 0.72))}" height="${Math.max(28, Math.floor(h * 0.18))}" rx="${Math.max(12, r - 12)}" fill="#cbd5e1" opacity="0.55"/>
    </g>
  </g>
</svg>`;
}

async function svgToPngDataUrl(svg: string, size: number): Promise<string> {
  const buf = await sharp(Buffer.from(svg), { density: 192 })
    .resize(size, size, { fit: 'cover', withoutEnlargement: true })
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function fetchOgImage(url: string): Promise<string | null> {
  const page = await fetchTextBestEffort(url, 5000);
  const html = page.text;
  if (!html) return null;
  const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw, url);
    return u.toString();
  } catch {
    return null;
  }
}

async function isValidImageUrl(url: string): Promise<boolean> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ac.signal });
    if (!(res.status >= 200 && res.status < 400)) return false;
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    return ct.startsWith('image/');
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function generateThumbnailDataUrl(params: {
  title: string;
  category: string | null;
  shortDescription?: string | null;
  confidenceScore: number | null;
  outboundUrl?: string | null;
}): Promise<{ url: string | null; source: 'real' | 'generated' | 'none'; inputHash: string }> {
  const inputHash = sha(`thumb:v2:${norm(params.title)}|${norm(params.category || '')}|${norm(params.shortDescription || '')}|conf=${params.confidenceScore ?? 'null'}`);

  // Tier 1: real product image (best-effort)
  if (params.outboundUrl) {
    const og = await fetchOgImage(params.outboundUrl).catch(() => null);
    if (og && (await isValidImageUrl(og).catch(() => false))) {
      return { url: og, source: 'real', inputHash };
    }
  }

  // Tier 2: deterministic product-specific generated image
  try {
    const svg = productSilhouetteSvg({ title: params.title, category: params.category, shortDescription: params.shortDescription ?? null, size: 512 });
    const url = await svgToPngDataUrl(svg, 150);
    return { url, source: 'generated', inputHash };
  } catch {
    return { url: null, source: 'none', inputHash };
  }
}

export async function generateHeroImageDataUrl(params: {
  title: string;
  category: string | null;
  shortDescription?: string | null;
  confidenceScore: number | null;
  outboundUrl?: string | null;
}): Promise<{ url: string | null; source: 'real' | 'generated' | 'none'; inputHash: string }> {
  const inputHash = sha(`hero:v2:${norm(params.title)}|${norm(params.category || '')}|${norm(params.shortDescription || '')}|conf=${params.confidenceScore ?? 'null'}`);

  // Tier 1: real product image (best-effort)
  if (params.outboundUrl) {
    const og = await fetchOgImage(params.outboundUrl).catch(() => null);
    if (og && (await isValidImageUrl(og).catch(() => false))) {
      return { url: og, source: 'real', inputHash };
    }
  }

  // Tier 2: deterministic product-specific generated image
  try {
    const svg = productSilhouetteSvg({ title: params.title, category: params.category, shortDescription: params.shortDescription ?? null, size: 512 });
    const buf = await sharp(Buffer.from(svg), { density: 192 })
      .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
    return { url: `data:image/webp;base64,${buf.toString('base64')}`, source: 'generated', inputHash };
  } catch {
    return { url: null, source: 'none', inputHash };
  }
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
