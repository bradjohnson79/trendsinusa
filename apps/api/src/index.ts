import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

import { prisma } from '@trendsinusa/db';
import { readSitesConfig } from '@trendsinusa/shared/server';

import { testDalleImageGeneration } from './diagnostics/testDalleImageGeneration.js';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type SiteRow = { key: string; name: string; domain?: string; enabled: boolean };

async function getSites(): Promise<SiteRow[]> {
  const sites = await readSitesConfig().then((x) => x.config.sites);
  return sites.map((s) => ({ key: s.key, name: s.name, domain: s.domain, enabled: s.enabled }));
}

function defaultSiteKey(sites: SiteRow[]): string {
  return sites.find((s) => s.enabled)?.key ?? sites[0]?.key ?? 'trendsinusa';
}

async function readPartnersConfig(): Promise<{ version: number; partners: unknown[] }> {
  // Keep it dead simple for now; schema lives in shared later if we need it.
  // This is read-only for Phase C.
  const raw = await readFile(new URL('../../config/partners.json', import.meta.url), 'utf8');
  const json = JSON.parse(raw) as any;
  const version = typeof json?.version === 'number' ? json.version : 1;
  const partners = Array.isArray(json?.partners) ? (json.partners as unknown[]) : [];
  return { version, partners };
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(data);
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function notFound(res: http.ServerResponse) {
  return json(res, 404, { error: 'not_found', message: 'Not found' });
}

function methodNotAllowed(res: http.ServerResponse) {
  return json(res, 405, { error: 'method_not_allowed', message: 'Method not allowed' });
}

function safeError(e: unknown) {
  return e instanceof Error ? e.message : 'Unknown error';
}

function truncateText(input: string, max = 4000): string {
  const s = String(input ?? '');
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function safeJsonForDiagnostics(val: unknown): unknown {
  // Avoid huge payloads; never include secrets (we never attach env vars anyway).
  try {
    const s = JSON.stringify(val);
    if (s.length <= 50_000) return val;
    return { truncated: true, preview: s.slice(0, 50_000) + '…' };
  } catch {
    return { truncated: true, preview: String(val) };
  }
}

type IngestionPreviewItem = {
  asin: string;
  rawAmazon: unknown | null;
  normalized: {
    asin: string;
    title: string | null;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    imageUrls: string[];
    productUrl: string | null;
    rating: number | null;
    reviewCount: number | null;
  } | null;
  ai: {
    ok: boolean;
    research?: unknown;
    final?: unknown;
    error?: string;
  } | null;
  error: string | null;
};

type IngestionPreviewRun = {
  id: string;
  provider: 'amazon';
  mode: 'dry_run';
  startedAt: string;
  finishedAt: string | null;
  ok: boolean;
  requested: { count: number; source: 'env_asins' | 'env_keywords' | 'default_keyword'; keyword?: string | null };
  items: IngestionPreviewItem[];
  errors: string[];
};

const ingestionPreviewState: { runs: IngestionPreviewRun[] } = { runs: [] };

function pushIngestionPreviewRun(run: IngestionPreviewRun) {
  ingestionPreviewState.runs.unshift(run);
  if (ingestionPreviewState.runs.length > 5) ingestionPreviewState.runs.length = 5;
}

function parseJsonObject<T>(s: string): T {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  const json = start !== -1 && end !== -1 ? s.slice(start, end + 1) : s;
  return JSON.parse(json) as T;
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function containsPriceClaims(s: string): boolean {
  const t = s.toLowerCase();
  return /\$\s?\d/.test(t) || /\bprice\b/.test(t) || /\busd\b/.test(t) || /\b\d+\s?(?:dollars|bucks)\b/.test(t);
}

function containsUnsourcedSuperlatives(s: string): boolean {
  const t = s.toLowerCase();
  return /\b(best|top|ultimate|perfect|greatest|no\.?\s?1|number\s?one)\b/.test(t);
}

type ResearchJson = { summary: string; sources: Array<{ url: string; title?: string }> };
type FinalJson = { summary: string; highlights: string[]; confidenceScore: number; sourcesUsed: string[] };

function validateResearch(r: ResearchJson) {
  const summary = normalizeWhitespace(String(r.summary ?? ''));
  if (!summary) throw new Error('Research JSON missing summary');
  const sources = Array.isArray(r.sources) ? r.sources : [];
  const normalizedSources: Array<{ url: string; title?: string }> = sources
    .map((x) => {
      const url = String((x as any)?.url ?? '').trim();
      const titleRaw = (x as any)?.title;
      const title = titleRaw != null ? String(titleRaw).trim() : '';
      return title ? ({ url, title } as { url: string; title: string }) : ({ url } as { url: string; title?: string });
    })
    .filter((x) => x.url.length > 0);
  return { summary, sources: normalizedSources };
}

function validateFinal(f: FinalJson) {
  const summary = normalizeWhitespace(String(f.summary ?? ''));
  const confidenceScore = Number((f as any).confidenceScore);
  const highlights = Array.isArray(f.highlights) ? f.highlights.map((h) => normalizeWhitespace(String(h ?? ''))).filter(Boolean) : [];
  const sourcesUsed = Array.isArray(f.sourcesUsed) ? f.sourcesUsed.map((u) => String(u ?? '').trim()).filter(Boolean) : [];

  if (!summary) throw new Error('Final JSON missing summary');
  if (!Number.isFinite(confidenceScore) || confidenceScore < 0 || confidenceScore > 1) throw new Error('Invalid confidenceScore');
  if (highlights.length < 3 || highlights.length > 5) throw new Error('highlights must be 3-5 bullets');
  if (containsPriceClaims(summary) || containsPriceClaims(highlights.join(' '))) throw new Error('price_claim_detected');
  if (containsUnsourcedSuperlatives(summary) || containsUnsourcedSuperlatives(highlights.join(' '))) throw new Error('superlative_detected');
  return { summary, confidenceScore, highlights, sourcesUsed };
}

async function dryRunAiEnrichment(params: { asin: string; title: string; category: string | null }) {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const researchModel = process.env.AI_RESEARCH_MODEL || 'sonar';
  const finalModel = process.env.AI_FINAL_MODEL || 'gpt-4.1';
  const minConfidence = Number(process.env.AI_MIN_CONFIDENCE ?? 0.6);

  if (!perplexityKey) throw new Error('Missing PERPLEXITY_API_KEY');
  if (!openaiKey) throw new Error('Missing OPENAI_API_KEY');

  const RESEARCH_SYSTEM = `You produce factual, neutral product research.
Rules:
- Neutral tone. No hype, no emojis.
- No pricing or deal claims.
- If you are uncertain, say so.
- Prefer citing sources.
Output MUST be valid JSON with keys:
  summary (string),
  sources (array of { url: string, title?: string }).`;

  const FINAL_SYSTEM = `You produce neutral product enrichment copy for an ecommerce catalog.
Rules:
- Never include pricing, discounts, or deal claims.
- No affiliate language.
- No superlatives unless directly supported by a source (then keep it minimal).
- No emojis, no exclamation marks.
Output MUST be valid JSON with keys:
  summary (string, 1-2 short paragraphs),
  highlights (array of 3-5 short bullet strings),
  confidenceScore (0..1),
  sourcesUsed (array of source urls used).`;

  const researchUser = `Research this product and produce a factual, neutral summary with sources.
Product:
- ASIN: ${params.asin}
- Title: ${params.title}
- Category: ${params.category ?? 'unknown'}

Return JSON exactly (no markdown).`;

  const researchRes = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${perplexityKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: researchModel,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: 'system', content: RESEARCH_SYSTEM },
        { role: 'user', content: researchUser },
      ],
    }),
  });
  const researchJson: any = await researchRes.json().catch(() => null);
  const researchText = String(researchJson?.choices?.[0]?.message?.content ?? '').trim();
  const researchParsed = validateResearch(parseJsonObject<ResearchJson>(researchText));

  const sourcesBlock = researchParsed.sources.length
    ? researchParsed.sources.map((s) => `- ${s.url}${s.title ? ` (${s.title})` : ''}`).join('\n')
    : '(none)';

  const finalUser = `Use the research to produce enriched catalog copy.

Product:
- ASIN: ${params.asin}
- Title: ${params.title}
- Category: ${params.category ?? 'unknown'}

Research summary:
${researchParsed.summary}

Sources:
${sourcesBlock}

Return JSON exactly (no markdown).`;

  const finalRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${openaiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: finalModel,
      temperature: 0.2,
      max_tokens: 650,
      messages: [
        { role: 'system', content: FINAL_SYSTEM },
        { role: 'user', content: finalUser },
      ],
    }),
  });
  const finalJsonRaw: any = await finalRes.json().catch(() => null);
  const finalText = String(finalJsonRaw?.choices?.[0]?.message?.content ?? '').trim();
  const finalParsed = validateFinal(parseJsonObject<FinalJson>(finalText));

  if (Number.isFinite(minConfidence) && finalParsed.confidenceScore < minConfidence) {
    return {
      ok: false,
      research: researchParsed,
      final: { ...finalParsed, blocked: `confidence_below_threshold:${finalParsed.confidenceScore.toFixed(2)}<${minConfidence.toFixed(2)}` },
    };
  }

  return { ok: true, research: researchParsed, final: finalParsed };
}

async function canQueryDb(): Promise<{ ok: boolean; message?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, message: safeError(e) };
  }
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const method = (req.method ?? 'GET').toUpperCase();

  // CORS (dev-friendly; production should lock this down)
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (method === 'OPTIONS') return res.end();

  // Basic health check
  if (path === '/api/health') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, { ok: true });
  }

  // -------------------------
  // Public: sitemap (includes unaffiliated posts)
  // -------------------------
  if (path === '/sitemap.xml') {
    if (method !== 'GET') return methodNotAllowed(res);
    const now = new Date();
    const baseUrl = String(process.env.PUBLIC_SITE_URL ?? 'https://trendsinusa.com').replace(/\/+$/, '');

    const posts = await prisma.unaffiliatedPost
      .findMany({
        where: { status: 'PUBLISHED', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        take: 5000,
        select: { slug: true, updatedAt: true, publishedAt: true },
      })
      .catch(() => []);

    function esc(s: string) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;');
    }

    const urlset = [
      { loc: `${baseUrl}/`, lastmod: now.toISOString() },
      { loc: `${baseUrl}/posts`, lastmod: now.toISOString() },
      ...posts.map((p: any) => ({
        loc: `${baseUrl}/posts/${encodeURIComponent(p.slug)}`,
        lastmod: (p.updatedAt ?? p.publishedAt ?? now).toISOString?.() ?? now.toISOString(),
      })),
    ];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urlset
        .map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${esc(u.lastmod)}</lastmod></url>`)
        .join('\n') +
      `\n</urlset>\n`;

    res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(xml);
  }

  // -------------------------
  // Admin: Provider enablement (credentials READY/LOCKED + admin enabled toggle)
  // -------------------------
  if (path === '/api/admin/providers') {
    if (method !== 'GET') return methodNotAllowed(res);
    const siteKey = url.searchParams.get('siteKey') ?? 'trendsinusa';
    const providers = ['AMAZON', 'WALMART', 'TARGET', 'BEST_BUY'] as const;

    const requiredEnv: Record<(typeof providers)[number], string[]> = {
      AMAZON: ['AMAZON_ACCESS_KEY', 'AMAZON_SECRET_KEY', 'AMAZON_ASSOCIATE_TAG'],
      WALMART: ['WALMART_API_KEY'],
      TARGET: ['TARGET_API_KEY'],
      BEST_BUY: ['BESTBUY_API_KEY'],
    };

    const cfg = await prisma.providerConfig
      .findMany({ where: { siteKey }, select: { provider: true, enabled: true } })
      .catch((): Array<{ provider: string; enabled: boolean }> => []);
    const enabledByProvider = new Map(cfg.map((c) => [String(c.provider), !!c.enabled]));

    const data = providers.map((p) => {
      const missing = (requiredEnv[p] ?? []).filter((k) => !process.env[k]);
      const credentials = { status: missing.length ? ('LOCKED' as const) : ('READY' as const), missing };
      const enabled = enabledByProvider.get(p) ?? false;
      return { provider: p, credentials, enabled };
    });

    return json(res, 200, { ok: true, data: { siteKey, providers: data } });
  }

  const providerToggleMatch = path.match(/^\/api\/admin\/providers\/([^/]+)\/(enable|disable)$/);
  if (providerToggleMatch) {
    if (method !== 'POST') return methodNotAllowed(res);
    await readJson(req).catch(() => null);
    const provider = decodeURIComponent(providerToggleMatch[1] ?? '').toUpperCase();
    const action = providerToggleMatch[2] ?? '';
    if (!['AMAZON', 'WALMART', 'TARGET', 'BEST_BUY'].includes(provider)) {
      return json(res, 400, { error: 'bad_request', message: 'Unknown provider' });
    }
    const siteKey = url.searchParams.get('siteKey') ?? 'trendsinusa';
    const enabled = action === 'enable';
    await prisma.providerConfig.upsert({
      where: { siteKey_provider: { siteKey, provider: provider as any } },
      create: { siteKey, provider: provider as any, enabled },
      update: { enabled },
    });
    return json(res, 200, { ok: true });
  }

  // -------------------------
  // Public: Discovery feed (non-commercial; AI discovery only)
  // -------------------------
  if (path === '/api/discovery') {
    if (method !== 'GET') return methodNotAllowed(res);
    const now = new Date();
    const limitRaw = Number(url.searchParams.get('limit') ?? '60');
    const take = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 60;

    const rows = await prisma.discoveryCandidate
      .findMany({
        where: { status: 'ACTIVE', discoveredAt: { lte: now } },
        orderBy: [{ confidenceScore: 'desc' }, { discoveredAt: 'desc' }, { id: 'asc' }],
        take,
        select: {
          id: true,
          title: true,
          retailer: true,
          category: true,
          description: true,
          imageQuery: true,
          outboundUrl: true,
          confidenceScore: true,
          source: true,
          status: true,
          discoveredAt: true,
          expiresAt: true,
        },
      })
      .catch(() => []);

    return json(res, 200, {
      now: now.toISOString(),
      candidates: rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        retailer: r.retailer,
        category: r.category ?? null,
        description: r.description ?? null,
        imageQuery: r.imageQuery ?? null,
        outboundUrl: r.outboundUrl,
        confidenceScore: r.confidenceScore ?? null,
        source: r.source,
        status: r.status,
        discoveredAt: r.discoveredAt.toISOString(),
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      })),
    });
  }

  // -------------------------
  // Public: Unaffiliated posts
  // -------------------------
  if (path === '/api/posts') {
    if (method !== 'GET') return methodNotAllowed(res);
    const now = new Date();
    const limitRaw = Number(url.searchParams.get('limit') ?? '20');
    const take = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.trunc(limitRaw))) : 20;
    const category = (url.searchParams.get('category') ?? '').trim();

    const where: any = { status: 'PUBLISHED', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
    if (category) where.category = category;

    const rows = await prisma.unaffiliatedPost
      .findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        take,
        select: {
          id: true,
          title: true,
          slug: true,
          retailer: true,
          category: true,
          summary: true,
          imageSetId: true,
          outboundUrl: true,
          source: true,
          status: true,
          publishedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .catch(() => []);

    return json(res, 200, {
      now: now.toISOString(),
      posts: rows.map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        retailer: p.retailer,
        category: p.category,
        summary: p.summary,
        imageSetId: p.imageSetId ?? null,
        outboundUrl: p.outboundUrl,
        source: p.source,
        status: p.status,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  }

  const postBySlugMatch = path.match(/^\/api\/posts\/([^/]+)$/);
  if (postBySlugMatch) {
    if (method !== 'GET') return methodNotAllowed(res);
    const now = new Date();
    const slug = decodeURIComponent(postBySlugMatch[1] ?? '');
    const row = await prisma.unaffiliatedPost
      .findUnique({
        where: { slug },
        select: {
          id: true,
          title: true,
          slug: true,
          retailer: true,
          category: true,
          summary: true,
          body: true,
          imageSetId: true,
          outboundUrl: true,
          source: true,
          status: true,
          publishedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .catch(() => null);
    if (!row) return json(res, 404, { error: 'not_found', message: 'Post not found' });
    if (row.status !== 'PUBLISHED') return json(res, 404, { error: 'not_found', message: 'Post not published' });
    if (row.expiresAt && row.expiresAt <= now) return json(res, 404, { error: 'not_found', message: 'Post expired' });

    return json(res, 200, {
      id: row.id,
      title: row.title,
      slug: row.slug,
      retailer: row.retailer,
      category: row.category,
      summary: row.summary,
      body: row.body,
      imageSetId: row.imageSetId ?? null,
      outboundUrl: row.outboundUrl,
      source: row.source,
      status: row.status,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }
  // Resolve default site key (best-effort; do not hard-fail).
  const sites = await getSites().catch(() => [] as SiteRow[]);
  const siteKey = defaultSiteKey(sites);

  // Generic admin pages (to eliminate placeholders + guarantee no 404s)
  const genericAdminPages: Record<string, string> = {
    '/api/admin/seo-promotion': 'SEO & Promotion',
    '/api/admin/banners-hero': 'Banners & Hero',
  };
  if (genericAdminPages[path]) {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, { ok: true, data: {} });
  }

  // -------------------------
  // Admin: Strategic & System pages (Phase D, read-only, structured, empty allowed)
  // -------------------------
  if (path === '/api/admin/intelligence') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, {
      ok: true,
      data: {
        siteKey,
        generatedAt: new Date().toISOString(),
        summaries: [],
        models: [],
        notes: [],
      },
    });
  }

  if (path === '/api/admin/signals') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        signals: [],
        suppressions: [],
      },
    });
  }

  if (path === '/api/admin/monetization') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, {
      ok: true,
      data: {
        siteKey,
        generatedAt: new Date().toISOString(),
        providers: [],
        experiments: [],
      },
    });
  }

  if (path === '/api/admin/governance') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        policies: [],
        audits: [],
        changeLog: [],
      },
    });
  }

  if (path === '/api/admin/network') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        nodes: [],
        edges: [],
      },
    });
  }

  if (path === '/api/admin/dependencies') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        // Intentionally empty until we wire real workspace dependency introspection.
        packages: [],
        advisories: [],
      },
    });
  }

  if (path === '/api/admin/partners') {
    if (method !== 'GET') return methodNotAllowed(res);
    const partners = await readPartnersConfig().catch(() => ({ version: 1, partners: [] as unknown[] }));
    return json(res, 200, { ok: true, data: partners });
  }

  if (path === '/api/admin/hold') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        available: false,
        reason: 'not_configured',
        holds: [],
      },
    });
  }

  if (path === '/api/admin/exit') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        available: false,
        reason: 'not_configured',
        reports: [],
      },
    });
  }

  if (path === '/api/admin/system-logs') {
    if (method !== 'GET') return methodNotAllowed(res);
    const [alerts, runs] = await Promise.all([
      prisma.systemAlert
        .findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, type: true, severity: true, message: true, noisy: true, resolvedAt: true, createdAt: true },
        })
        .catch(() => []),
      prisma.ingestionRun
        .findMany({
          orderBy: { startedAt: 'desc' },
          take: 25,
          select: { id: true, source: true, status: true, startedAt: true, finishedAt: true, productsProcessed: true, dealsProcessed: true, error: true },
        })
        .catch(() => []),
    ]);

    return json(res, 200, {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        alerts: alerts.map((a) => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          message: a.message,
          noisy: a.noisy,
          resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
          createdAt: a.createdAt.toISOString(),
        })),
        ingestionRuns: runs.map((r) => ({
          id: r.id,
          source: r.source,
          status: r.status,
          startedAt: r.startedAt.toISOString(),
          finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
          productsProcessed: r.productsProcessed,
          dealsProcessed: r.dealsProcessed,
          error: r.error ?? null,
        })),
        ingestionPreview: {
          runs: ingestionPreviewState.runs.map((r) => ({
            ...r,
            items: r.items.map((it) => ({
              asin: it.asin,
              error: it.error,
              rawAmazon: safeJsonForDiagnostics(it.rawAmazon),
              normalized: it.normalized,
              ai: it.ai
                ? {
                    ok: it.ai.ok,
                    error: it.ai.error ?? null,
                    research: safeJsonForDiagnostics(it.ai.research),
                    final: safeJsonForDiagnostics(it.ai.final),
                  }
                : null,
            })),
          })),
        },
      },
    });
  }

  // -------------------------
  // Admin: Analytics (read-only, Phase C)
  // -------------------------
  if (path === '/api/admin/analytics') {
    if (method !== 'GET') return methodNotAllowed(res);
    const sites = await readSitesConfig().then((x) => x.config.sites);
    const requested = url.searchParams.get('site');
    const selected =
      (requested && sites.find((s) => s.key === requested)?.key) ??
      (sites.find((s) => s.enabled)?.key ?? sites[0]?.key ?? 'trendsinusa');

    const cfg = await prisma.analyticsConfig
      .findUnique({
        where: { siteKey: selected },
        select: { gaEnabled: true, gaMeasurementId: true, lastEventAt: true },
      })
      .catch(() => null);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    return json(res, 200, {
      selectedSite: selected,
      sites: sites.map((s) => ({ key: s.key, name: s.name, enabled: s.enabled, domain: s.domain })),
      ga: {
        enabled: cfg?.gaEnabled ?? false,
        measurementId: cfg?.gaMeasurementId ?? null,
        lastEventAt: cfg?.lastEventAt ? cfg.lastEventAt.toISOString() : null,
      },
      ctrReport: {
        since,
        bySection: [],
        byDealState: [],
        topCtas: [],
      },
    });
  }

  // -------------------------
  // Admin: Revenue (read-only, Phase C)
  // -------------------------
  if (path === '/api/admin/revenue') {
    if (method !== 'GET') return methodNotAllowed(res);
    const now = new Date();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const clicks = await prisma.clickEvent.findMany({
      where: { occurredAt: { gte: since, lte: now } },
      select: { occurredAt: true },
      orderBy: { occurredAt: 'asc' },
      take: 5000,
    });

    const byDay = new Map<string, number>();
    for (const c of clicks) {
      const day = isoDay(c.occurredAt);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    const clicksByDay = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, count]) => ({ day, clicks: count }));

    return json(res, 200, {
      ok: true,
      data: {
        since: since.toISOString(),
        through: now.toISOString(),
        affiliateOutboundClicks: {
          total: clicks.length,
          byDay: clicksByDay,
        },
        revenue: {
          available: false,
          reason: 'no_revenue_source_configured',
        },
      },
    });
  }

  // -------------------------
  // Admin: Portfolio (read-only, Phase C)
  // -------------------------
  if (path === '/api/admin/portfolio') {
    if (method !== 'GET') return methodNotAllowed(res);
    const sites = await readSitesConfig().then((x) => x.config.sites);
    const partners = await readPartnersConfig().catch(() => ({ version: 1, partners: [] as unknown[] }));
    return json(res, 200, {
      ok: true,
      data: {
        sites: sites.map((s) => ({
          key: s.key,
          name: s.name,
          enabled: s.enabled,
          domain: s.domain,
        })),
        partners,
      },
    });
  }

  // -------------------------
  // Admin: Automation (Growth & Monetization Controls)
  // -------------------------
  if (path === '/api/admin/automation') {
    if (method !== 'GET') return methodNotAllowed(res);
    const now = new Date();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const supportedScheduledJobs = [
      { jobType: 'DISCOVERY_SWEEP', defaultCron: '*/30 * * * *', name: 'Discovery sweep (AI-only)' },
      { jobType: 'UNAFFILIATED_PUBLISHER', defaultCron: '0 * * * *', name: 'Unaffiliated publisher' },
    ] as const;

    const [runs24h, avgConfidenceAgg, productsWithAI, dealsFeatured, dealsSuppressed, errors, cfg, gate, scheduleRows] = await Promise.all([
      prisma.aIActionLog.count({ where: { startedAt: { gte: since24h, lte: now } } }).catch(() => 0),
      prisma.aIActionLog
        .aggregate({ where: { startedAt: { gte: since24h, lte: now }, confidenceScore: { not: null } }, _avg: { confidenceScore: true } })
        .catch(() => ({ _avg: { confidenceScore: null as number | null } })),
      prisma.product.count({ where: { aiFinalSummary: { not: null } } }).catch(() => 0),
      prisma.deal.count({ where: { aiFeatured: true, aiEvaluatedAt: { gte: since24h, lte: now } } }).catch(() => 0),
      prisma.deal.count({ where: { aiSuppressed: true, aiEvaluatedAt: { gte: since24h, lte: now } } }).catch(() => 0),
      prisma.systemAlert
        .findMany({ where: { resolvedAt: null, noisy: false, type: 'AI_COPY_FAILURE' }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, type: true, message: true } })
        .catch((): Array<{ id: string; type: string; message: string }> => []),
      prisma.automationConfig
        .findUnique({
          where: { siteKey },
          select: { siteKey: true, automationEnabled: true, imageGenEnabled: true, heroRegenerateAt: true, categoryRegenerateAt: true },
        })
        .catch(() => null),
      prisma.automationGate
        .findUnique({ where: { siteKey }, select: { unaffiliatedAutoPublishEnabled: true } })
        .catch(() => null),
      prisma.automationSchedule
        .findMany({
          where: { siteKey, jobType: { in: supportedScheduledJobs.map((j) => j.jobType) as any } },
          select: { id: true, siteKey: true, jobType: true, enabled: true, cron: true, timezone: true, lastScheduledAt: true },
        })
        .catch(() => [] as any[]),
    ]);

    const automationEnabled = cfg?.automationEnabled ?? false;
    const jobTypes = [
      { key: 'AMAZON_PRODUCTS_REFRESH', name: 'Amazon products refresh' },
      { key: 'AMAZON_DEALS_REFRESH', name: 'Amazon deals refresh' },
      { key: 'DISCOVERY_SWEEP', name: 'Discovery sweep (AI-only)' },
      { key: 'UNAFFILIATED_PUBLISHER', name: 'Unaffiliated publisher' },
    ] as const;

    const latestByType = await Promise.all(
      jobTypes.map(async (j) => {
        const latest = await prisma.systemCommand
          .findFirst({
            where: { type: j.key as any, siteKey },
            orderBy: { requestedAt: 'desc' },
            select: { id: true, status: true, requestedAt: true, processedAt: true, error: true },
          })
          .catch(() => null);
        return { ...j, latest };
      }),
    );

    const jobs = latestByType.map((j) => {
      const latest = j.latest;
      const running = !!latest && latest.status === 'STARTED' && !latest.processedAt;
      const status: 'idle' | 'running' | 'paused' = !automationEnabled ? 'paused' : running ? 'running' : 'idle';
      const lastRunAt = latest?.processedAt ? latest.processedAt.toISOString() : latest?.requestedAt ? latest.requestedAt.toISOString() : null;
      const lastError = latest?.status === 'FAILURE' ? (latest.error ?? 'Unknown error') : null;
      return { key: j.key, name: j.name, status, lastRunAt, lastError };
    });

    // Scheduling helpers (UTC only; fail-closed)
    function nextRunFromCronUtc(cron: string, after: Date): string | null {
      try {
        const parts = cron.trim().split(/\s+/);
        if (parts.length !== 5) return null;
        const minute = parts[0]!;
        const hour = parts[1]!;
        const dom = parts[2]!;
        const mon = parts[3]!;
        const dow = parts[4]!;

        const parseField = (field: string, min: number, max: number): { any: true } | { values: Set<number> } => {
          const raw = field.trim();
          if (raw === '*') return { any: true };
          const out = new Set<number>();
          for (const token0 of raw.split(',')) {
            const token = token0.trim();
            if (!token) continue;
            if (token.startsWith('*/')) {
              const step = Number(token.slice(2));
              if (!Number.isFinite(step) || step <= 0) return { values: new Set<number>() };
              for (let v = min; v <= max; v += step) out.add(v);
              continue;
            }
            if (token.includes('-')) {
              const [aRaw, bRaw] = token.split('-', 2);
              const a = Math.trunc(Number(aRaw));
              const b = Math.trunc(Number(bRaw));
              if (!Number.isFinite(a) || !Number.isFinite(b)) return { values: new Set<number>() };
              const start = Math.max(min, Math.min(max, a));
              const end = Math.max(min, Math.min(max, b));
              for (let v = Math.min(start, end); v <= Math.max(start, end); v++) out.add(v);
              continue;
            }
            const v = Math.trunc(Number(token));
            if (!Number.isFinite(v) || v < min || v > max) return { values: new Set<number>() };
            out.add(v);
          }
          return out.size ? { values: out } : { values: new Set<number>() };
        };

        const fMin = parseField(minute, 0, 59);
        const fHour = parseField(hour, 0, 23);
        const fDom = parseField(dom, 1, 31);
        const fMon = parseField(mon, 1, 12);
        const fDow = parseField(dow, 0, 6);

        const match = (f: any, v: number) => (f.any ? true : f.values.has(v));
        const matches = (d: Date) =>
          match(fMin, d.getUTCMinutes()) &&
          match(fHour, d.getUTCHours()) &&
          match(fDom, d.getUTCDate()) &&
          match(fMon, d.getUTCMonth() + 1) &&
          match(fDow, d.getUTCDay());

        const cur = new Date(after.getTime());
        cur.setUTCSeconds(0, 0);
        cur.setUTCMinutes(cur.getUTCMinutes() + 1);
        for (let i = 0; i < 31 * 24 * 60; i++) {
          if (matches(cur)) return cur.toISOString();
          cur.setTime(cur.getTime() + 60_000);
        }
        return null;
      } catch {
        return null;
      }
    }

    const scheduleByType = new Map<string, any>(scheduleRows.map((r) => [String(r.jobType), r]));
    const unaffGateOn = Boolean(gate?.unaffiliatedAutoPublishEnabled);

    const schedules = supportedScheduledJobs.map((j) => {
      const row = scheduleByType.get(j.jobType) ?? null;
      const enabled = Boolean(row?.enabled);
      const cron = String(row?.cron ?? j.defaultCron);
      const timezone = String(row?.timezone ?? 'UTC');
      const lastScheduledAt = row?.lastScheduledAt ? row.lastScheduledAt.toISOString() : null;

      const running = latestByType.find((x) => x.key === j.jobType)?.latest?.status === 'STARTED' && !latestByType.find((x) => x.key === j.jobType)?.latest?.processedAt;

      let blockedReason: string | null = null;
      if (!automationEnabled) blockedReason = 'Automation is disabled';
      else if (j.jobType === 'UNAFFILIATED_PUBLISHER' && !unaffGateOn) blockedReason = 'Auto-publishing disabled';
      else if (timezone !== 'UTC') blockedReason = 'Timezone not supported (must be UTC)';
      else if (!nextRunFromCronUtc(cron, now)) blockedReason = 'Invalid cron';

      const status: 'idle' | 'running' | 'blocked' = blockedReason ? 'blocked' : running ? 'running' : 'idle';
      const nextRunAt = enabled && timezone === 'UTC' ? nextRunFromCronUtc(cron, now) : null;

      return { jobType: j.jobType, enabled, cron, timezone, lastScheduledAt, nextRunAt, status, blockedReason };
    });

    return json(res, 200, {
      runs24h,
      avgConfidence24h: avgConfidenceAgg._avg.confidenceScore,
      productsWithAI,
      dealsFeatured,
      dealsSuppressed,
      errors: errors.map((a: { id: string; type: string; message: string }) => ({ id: a.id, type: a.type, message: a.message })),
      config: {
        siteKey,
        automationEnabled,
        imageGenEnabled: cfg?.imageGenEnabled ?? false,
        heroRegenerateAt: cfg?.heroRegenerateAt ? cfg.heroRegenerateAt.toISOString() : null,
        categoryRegenerateAt: cfg?.categoryRegenerateAt ? cfg.categoryRegenerateAt.toISOString() : null,
      },
      publishing: {
        unaffiliatedAutoPublishEnabled: Boolean(gate?.unaffiliatedAutoPublishEnabled),
      },
      schedules,
      jobs,
    });
  }

  const scheduleMatch = path.match(/^\/api\/admin\/automation\/schedules\/([^/]+)$/);
  if (scheduleMatch) {
    if (method !== 'POST') return methodNotAllowed(res);
    const jobType = decodeURIComponent(scheduleMatch[1] ?? '');
    if (!['DISCOVERY_SWEEP', 'UNAFFILIATED_PUBLISHER'].includes(jobType)) {
      return json(res, 400, { error: 'bad_request', message: 'Unsupported jobType' });
    }
    const body = (await readJson(req).catch(() => null)) as any;
    const enabled = body?.enabled != null ? Boolean(body.enabled) : undefined;
    const cron = body?.cron != null ? String(body.cron).trim() : undefined;
    const timezone = body?.timezone != null ? String(body.timezone).trim() : 'UTC';
    if (timezone !== 'UTC') return json(res, 400, { error: 'bad_request', message: 'Only timezone=UTC is supported' });

    const defaults: Record<string, string> = { DISCOVERY_SWEEP: '*/30 * * * *', UNAFFILIATED_PUBLISHER: '0 * * * *' };
    const existing = await prisma.automationSchedule.findUnique({ where: { siteKey_jobType: { siteKey, jobType: jobType as any } }, select: { id: true, cron: true } }).catch(() => null);
    const cronToWrite = cron ?? existing?.cron ?? defaults[jobType] ?? '0 */6 * * *';

    await prisma.automationSchedule.upsert({
      where: { siteKey_jobType: { siteKey, jobType: jobType as any } },
      create: { siteKey, jobType: jobType as any, enabled: enabled ?? false, cron: cronToWrite, timezone },
      update: {
        ...(enabled != null ? { enabled } : {}),
        cron: cronToWrite,
        timezone,
      },
      select: { id: true },
    });
    return json(res, 200, { ok: true });
  }

  // -------------------------
  // Admin: Publishing controls (Unaffiliated)
  // -------------------------
  if (path === '/api/admin/automation/unaffiliated-auto-publish') {
    if (method !== 'POST') return methodNotAllowed(res);
    const body = (await readJson(req).catch(() => null)) as any;
    const enabled = Boolean(body?.enabled);
    await prisma.automationGate.upsert({
      where: { siteKey },
      create: { siteKey, unaffiliatedAutoPublishEnabled: enabled },
      update: { unaffiliatedAutoPublishEnabled: enabled },
      select: { id: true },
    });
    return json(res, 200, { ok: true });
  }

  // -------------------------
  // Admin: Automation diagnostics (on-demand; no DB writes)
  // -------------------------
  if (path === '/api/admin/automation/diagnostics/openai') {
    if (method !== 'POST') return methodNotAllowed(res);
    const body = (await readJson(req).catch(() => null)) as any;
    const prompt = String(body?.prompt ?? '').trim();
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.AI_REVIEW_MODEL || 'gpt-4.1-mini';
    if (!apiKey) return json(res, 200, { ok: false, provider: 'openai', model, error: 'missing_OPENAI_API_KEY' });
    if (!prompt) return json(res, 400, { error: 'bad_request', message: 'prompt is required' });

    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 120,
          messages: [
            { role: 'system', content: 'You are a diagnostics bot. Respond concisely.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      const j: any = await r.json().catch(() => null);
      const text = j?.choices?.[0]?.message?.content ?? null;
      // server-side log (no DB)
      // eslint-disable-next-line no-console
      console.log('[diagnostics][openai]', { ok: r.ok, status: r.status, model, prompt: truncateText(prompt, 200), outputText: truncateText(String(text ?? ''), 500) });
      return json(res, 200, { ok: r.ok, provider: 'openai', model, outputText: text ? truncateText(String(text), 8000) : null, raw: safeJsonForDiagnostics(j) });
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.log('[diagnostics][openai][error]', safeError(e));
      return json(res, 200, { ok: false, provider: 'openai', model, error: safeError(e) });
    }
  }

  if (path === '/api/admin/automation/diagnostics/perplexity') {
    if (method !== 'POST') return methodNotAllowed(res);
    const body = (await readJson(req).catch(() => null)) as any;
    const query = String(body?.query ?? '').trim();
    const apiKey = process.env.PERPLEXITY_API_KEY;
    const model = process.env.PERPLEXITY_MODEL || 'sonar';
    if (!apiKey) return json(res, 200, { ok: false, provider: 'perplexity', model, error: 'missing_PERPLEXITY_API_KEY' });
    if (!query) return json(res, 400, { error: 'bad_request', message: 'query is required' });

    try {
      const r = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 160,
          messages: [
            { role: 'system', content: 'You are a diagnostics bot. Respond concisely.' },
            { role: 'user', content: query },
          ],
        }),
      });
      const j: any = await r.json().catch(() => null);
      const text = j?.choices?.[0]?.message?.content ?? null;
      // eslint-disable-next-line no-console
      console.log('[diagnostics][perplexity]', { ok: r.ok, status: r.status, model, query: truncateText(query, 200), outputText: truncateText(String(text ?? ''), 500) });
      return json(res, 200, { ok: r.ok, provider: 'perplexity', model, outputText: text ? truncateText(String(text), 8000) : null, raw: safeJsonForDiagnostics(j) });
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.log('[diagnostics][perplexity][error]', safeError(e));
      return json(res, 200, { ok: false, provider: 'perplexity', model, error: safeError(e) });
    }
  }

  // -------------------------
  // Admin: DALL·E / Images API readiness (safe; no persistence)
  // -------------------------
  if (path === '/api/admin/diagnostics/dalle') {
    if (method !== 'GET') return methodNotAllowed(res);
    const out = await testDalleImageGeneration();
    // server-side log (no DB)
    // eslint-disable-next-line no-console
    console.log('[diagnostics][dalle]', {
      success: out.success,
      model: out.model,
      size: out.size,
      elapsedMs: out.elapsedMs,
      image: out.image,
      error: out.error?.message ?? null,
      httpStatus: out.error?.httpStatus ?? null,
      kind: out.error?.kind ?? null,
    });
    return json(res, 200, out);
  }

  // -------------------------
  // Admin: Ingestion preview (dry-run; no DB writes)
  // -------------------------
  if (path === '/api/admin/ingestion-preview/amazon') {
    if (method !== 'POST') return methodNotAllowed(res);
    await readJson(req).catch(() => null);

    const startedAt = new Date();
    const runId = `amazon_dry_${startedAt.getTime()}`;
    const errors: string[] = [];
    const items: IngestionPreviewItem[] = [];

    // Preflight 1: require at least one enabled Site (ingestion safety rule).
    const enabledSites = await prisma.site.count({ where: { enabled: true } }).catch(() => 0);
    if (enabledSites < 1) {
      errors.push('No enabled Site exists. Enable a site in Admin → Sites before running ingestion previews.');
    }

    // Preflight 2: explicit Amazon PA-API credential check (do not rely on downstream throws).
    // These are required for any PA-API call.
    const missingAmazonEnv: string[] = [];
    if (!process.env.AMAZON_ACCESS_KEY) missingAmazonEnv.push('AMAZON_ACCESS_KEY');
    if (!process.env.AMAZON_SECRET_KEY) missingAmazonEnv.push('AMAZON_SECRET_KEY');
    if (!process.env.AMAZON_ASSOCIATE_TAG) missingAmazonEnv.push('AMAZON_ASSOCIATE_TAG');
    if (missingAmazonEnv.length) {
      errors.push(`Missing PA-API env vars: ${missingAmazonEnv.join(', ')}`);
    }

    // Resolve ASINs (5-10) from env or fallback keyword search.
    const asinsEnv = String(process.env.AMAZON_INGEST_ASINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toUpperCase());
    const keywordsEnv = String(process.env.AMAZON_INGEST_KEYWORDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const count = Math.max(5, Math.min(10, Number(process.env.AMAZON_INGEST_LIMIT ?? 10) || 10));

    let requestedSource: IngestionPreviewRun['requested']['source'] = 'default_keyword';
    let keywordUsed: string | null = null;
    let asins: string[] = [];

    try {
      // If preflight failed, do not attempt network calls; just emit the run record.
      if (errors.length) throw new Error(errors[0] ?? 'preflight_failed');

      const paapiMod: any = await import(new URL('../../worker/dist/amazon/paapi.js', import.meta.url).toString());
      if (asinsEnv.length) {
        requestedSource = 'env_asins';
        asins = asinsEnv.slice(0, count);
        for (const asin of asins) {
          try {
            const p = await paapiMod.fetchProductByASIN(asin);
            if (!p) {
              items.push({ asin, rawAmazon: null, normalized: null, ai: null, error: 'paapi_product_not_found' });
              continue;
            }
            const normalized = {
              asin: p.asin,
              title: p.title ?? null,
              brand: p.brand ?? null,
              category: p.category ?? null,
              imageUrl: p.imageUrl ?? null,
              imageUrls: Array.isArray(p.imageUrls) ? p.imageUrls : [],
              productUrl: p.detailPageUrl ?? null,
              rating: p.rating ?? null,
              reviewCount: p.reviewCount ?? null,
            };

            let ai: IngestionPreviewItem['ai'] = null;
            try {
              if (normalized.title) {
                const enr = await dryRunAiEnrichment({ asin: normalized.asin, title: normalized.title, category: normalized.category });
                ai = { ok: enr.ok, research: enr.research, final: enr.final };
              } else {
                ai = { ok: false, error: 'missing_title', research: null, final: null };
              }
            } catch (e: unknown) {
              ai = { ok: false, error: safeError(e), research: null, final: null };
            }

            items.push({ asin: normalized.asin, rawAmazon: p.raw ?? null, normalized, ai, error: null });
          } catch (e: unknown) {
            const msg = safeError(e);
            items.push({ asin, rawAmazon: null, normalized: null, ai: null, error: msg });
          }
        }
      } else {
        requestedSource = keywordsEnv.length ? 'env_keywords' : 'default_keyword';
        keywordUsed = keywordsEnv[0] ?? 'wireless charger';
        const found = await paapiMod.fetchProductsByCategory({ keyword: keywordUsed, limit: count });
        const list = Array.isArray(found) ? found.slice(0, count) : [];
        asins = list.map((p: any) => String(p.asin ?? '').toUpperCase()).filter(Boolean);

        for (const p of list) {
          const asin = String(p.asin ?? '').toUpperCase();
          const normalized = {
            asin,
            title: (p.title ?? null) as string | null,
            brand: (p.brand ?? null) as string | null,
            category: (p.category ?? null) as string | null,
            imageUrl: (p.imageUrl ?? null) as string | null,
            imageUrls: Array.isArray(p.imageUrls) ? p.imageUrls : [],
            productUrl: (p.detailPageUrl ?? null) as string | null,
            rating: (p.rating ?? null) as number | null,
            reviewCount: (p.reviewCount ?? null) as number | null,
          };

          let ai: IngestionPreviewItem['ai'] = null;
          try {
            if (normalized.title) {
              const enr = await dryRunAiEnrichment({ asin: normalized.asin, title: normalized.title, category: normalized.category });
              ai = { ok: enr.ok, research: enr.research, final: enr.final };
            } else {
              ai = { ok: false, error: 'missing_title', research: null, final: null };
            }
          } catch (e: unknown) {
            ai = { ok: false, error: safeError(e), research: null, final: null };
          }

          items.push({ asin, rawAmazon: p.raw ?? null, normalized, ai, error: null });
        }
      }
    } catch (e: unknown) {
      errors.push(safeError(e));
    }

    const finishedAt = new Date();
    const ok = errors.length === 0 && items.every((it) => !it.error);
    const run: IngestionPreviewRun = {
      id: runId,
      provider: 'amazon',
      mode: 'dry_run',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      ok,
      requested: { count, source: requestedSource, keyword: keywordUsed },
      items,
      errors,
    };

    pushIngestionPreviewRun(run);

    // server-side log summary (no DB)
    // eslint-disable-next-line no-console
    console.log('[ingestion-preview][amazon][dry-run]', {
      id: run.id,
      ok: run.ok,
      requested: run.requested,
      items: run.items.length,
      errors: run.errors,
    });

    return json(res, 200, { ok: true, runId: run.id });
  }

  if (path === '/api/admin/automation/enable') {
    if (method !== 'POST') return methodNotAllowed(res);
    await readJson(req).catch(() => null);
    const existing = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { id: true } }).catch(() => null);
    if (existing) await prisma.automationConfig.update({ where: { siteKey }, data: { automationEnabled: true } });
    else await prisma.automationConfig.create({ data: { siteKey, automationEnabled: true } });
    return json(res, 200, { ok: true });
  }
  if (path === '/api/admin/automation/disable') {
    if (method !== 'POST') return methodNotAllowed(res);
    await readJson(req).catch(() => null);
    const existing = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { id: true } }).catch(() => null);
    if (existing) await prisma.automationConfig.update({ where: { siteKey }, data: { automationEnabled: false } });
    else await prisma.automationConfig.create({ data: { siteKey, automationEnabled: false } });
    // Cancel any running commands (fail closed; does not execute work).
    await prisma.systemCommand.updateMany({
      where: { siteKey, status: 'STARTED', processedAt: null },
      data: { status: 'FAILURE', processedAt: new Date(), error: 'automation_disabled' },
    });
    return json(res, 200, { ok: true });
  }

  const autoJobRunMatch = path.match(/^\/api\/admin\/automation\/jobs\/([^/]+)\/run$/);
  if (autoJobRunMatch) {
    if (method !== 'POST') return methodNotAllowed(res);
    await readJson(req).catch(() => null);
    const type = decodeURIComponent(autoJobRunMatch[1] ?? '');
    if (!['AMAZON_PRODUCTS_REFRESH', 'AMAZON_DEALS_REFRESH', 'DISCOVERY_SWEEP', 'UNAFFILIATED_PUBLISHER'].includes(type)) {
      return json(res, 400, { error: 'bad_request', message: 'Unknown job' });
    }
    const cfg = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { automationEnabled: true } }).catch(() => null);
    if (!cfg?.automationEnabled) {
      return json(res, 409, { error: 'automation_paused', message: 'Automation is disabled (paused).' });
    }
    const already = await prisma.systemCommand.findFirst({ where: { siteKey, type: type as any, status: 'STARTED', processedAt: null }, select: { id: true } }).catch(() => null);
    if (already) return json(res, 409, { error: 'already_running', message: 'Job is already running.' });

    await prisma.systemCommand.create({
      data: {
        type: type as any,
        siteKey,
        status: 'STARTED',
        requestedAt: new Date(),
        metadata: { manual: true },
      },
    });
    return json(res, 200, { ok: true });
  }

  const autoJobCancelMatch = path.match(/^\/api\/admin\/automation\/jobs\/([^/]+)\/cancel$/);
  if (autoJobCancelMatch) {
    if (method !== 'POST') return methodNotAllowed(res);
    await readJson(req).catch(() => null);
    const type = decodeURIComponent(autoJobCancelMatch[1] ?? '');
    if (!['AMAZON_PRODUCTS_REFRESH', 'AMAZON_DEALS_REFRESH', 'DISCOVERY_SWEEP', 'UNAFFILIATED_PUBLISHER'].includes(type)) {
      return json(res, 400, { error: 'bad_request', message: 'Unknown job' });
    }
    const running = await prisma.systemCommand
      .findFirst({ where: { siteKey, type: type as any, status: 'STARTED', processedAt: null }, orderBy: { requestedAt: 'desc' }, select: { id: true } })
      .catch(() => null);
    if (!running) return json(res, 200, { ok: true, message: 'No running job to cancel.' });
    await prisma.systemCommand.update({ where: { id: running.id }, data: { status: 'FAILURE', processedAt: new Date(), error: 'cancelled_by_admin' } });
    return json(res, 200, { ok: true });
  }
  if (path === '/api/admin/automation/image-gen') {
    if (method !== 'POST') return methodNotAllowed(res);
    const body = (await readJson(req).catch(() => null)) as any;
    const enabled = !!body?.enabled;
    const existing = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { id: true } }).catch(() => null);
    if (existing) {
      await prisma.automationConfig.update({ where: { siteKey }, data: { imageGenEnabled: enabled } });
    } else {
      await prisma.automationConfig.create({ data: { siteKey, imageGenEnabled: enabled } });
    }
    return json(res, 200, { ok: true });
  }
  if (path === '/api/admin/automation/hero-regenerate') {
    if (method !== 'POST') return methodNotAllowed(res);
    await readJson(req).catch(() => null);
    const existing = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { id: true } }).catch(() => null);
    if (existing) {
      await prisma.automationConfig.update({ where: { siteKey }, data: { heroRegenerateAt: new Date() } });
    } else {
      await prisma.automationConfig.create({ data: { siteKey, heroRegenerateAt: new Date() } });
    }
    return json(res, 200, { ok: true });
  }
  if (path === '/api/admin/automation/category-regenerate') {
    if (method !== 'POST') return methodNotAllowed(res);
    await readJson(req).catch(() => null);
    const existing = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { id: true } }).catch(() => null);
    if (existing) {
      await prisma.automationConfig.update({ where: { siteKey }, data: { categoryRegenerateAt: new Date() } });
    } else {
      await prisma.automationConfig.create({ data: { siteKey, categoryRegenerateAt: new Date() } });
    }
    return json(res, 200, { ok: true });
  }

  // -------------------------
  // Admin: SEO dashboard (required endpoint: /api/admin/seo/dashboard)
  // -------------------------
  if (path === '/api/admin/seo/dashboard') {
    if (method !== 'GET') return methodNotAllowed(res);
    return json(res, 200, {
      ok: true,
      data: {
        siteKey,
        indexedPages: 0,
        lastSitemapAt: null,
        lastIndexPingAt: null,
        issues: [],
      },
    });
  }

  // -------------------------
  // Admin: Banners (required endpoint: /api/admin/banners)
  // -------------------------
  if (path === '/api/admin/banners') {
    if (method !== 'GET') return methodNotAllowed(res);
    const hero = await prisma.banner.findFirst({ where: { key: 'hero' }, select: { imageUrl: true, updatedAt: true } }).catch(() => null);
    const banners = await prisma.banner
      .findMany({
        where: { OR: [{ key: null }, { key: { not: 'hero' } }] },
        orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }],
        take: 200,
        select: { id: true, key: true, title: true, imageUrl: true, enabled: true, category: true },
      })
      .catch(() => []);

    return json(res, 200, {
      ok: true,
      data: {
        siteKey,
        hero: {
          imageUrl: hero?.imageUrl ?? null,
          updatedAt: hero?.updatedAt ? hero.updatedAt.toISOString() : null,
        },
        banners: banners.map((b) => ({
          id: b.id,
          placement: b.category ?? b.key ?? 'general',
          title: b.title ?? '',
          imageUrl: b.imageUrl ?? null,
          href: null,
          enabled: b.enabled,
        })),
      },
    });
  }

  // -------------------------
  // Admin: Affiliate (required endpoint: /api/admin/affiliate)
  // -------------------------
  if (path === '/api/admin/affiliate') {
    if (method !== 'GET') return methodNotAllowed(res);
    const cfg = await prisma.affiliateConfig
      .findFirst({ where: { siteKey, region: 'US' }, select: { enabled: true, associateTag: true } })
      .catch(() => null);
    const providers = await prisma.affiliateProviderConfig
      .findMany({
        where: { siteKey },
        orderBy: [{ priority: 'asc' }, { provider: 'asc' }],
        select: { provider: true, enabled: true, affiliateId: true, priority: true, linkTemplate: true },
      })
      .catch(() => []);

    const sampleUrl = 'https://www.amazon.com/dp/B0C1234567';
    const enabled = cfg?.enabled ?? false;
    const tag = cfg?.associateTag ?? null;
    const ok = enabled && !!tag;
    const urlOut = ok ? `${sampleUrl}${sampleUrl.includes('?') ? '&' : '?'}tag=${encodeURIComponent(String(tag))}` : undefined;
    const reason = !enabled ? 'disabled' : !tag ? 'missing_tag' : 'unknown';

    return json(res, 200, {
      siteKey,
      enabled,
      associateTag: tag,
      providerConfigs: providers.map((p) => ({
        provider: p.provider,
        enabled: p.enabled,
        affiliateId: p.affiliateId ?? null,
        priority: p.priority,
        linkTemplate: p.linkTemplate ?? null,
      })),
      sampleUrl,
      preview: ok ? { ok: true, url: urlOut } : { ok: false, reason },
    });
  }
  if (path === '/api/admin/affiliate/settings') {
    if (method !== 'POST') return methodNotAllowed(res);
    const body = (await readJson(req).catch(() => null)) as any;
    const enabled = !!body?.enabled;
    const associateTag = body?.associateTag ? String(body.associateTag) : null;
    const existing = await prisma.affiliateConfig.findFirst({ where: { siteKey, region: 'US' }, select: { id: true } }).catch(() => null);
    if (existing) {
      await prisma.affiliateConfig.update({ where: { id: existing.id }, data: { enabled, associateTag } });
    } else {
      await prisma.affiliateConfig.create({ data: { siteKey, region: 'US', enabled, associateTag } });
    }
    return json(res, 200, { ok: true });
  }
  if (path === '/api/admin/affiliate/provider') {
    if (method !== 'POST') return methodNotAllowed(res);
    const body = (await readJson(req).catch(() => null)) as any;
    const provider = String(body?.provider ?? '');
    if (!['AMAZON', 'WALMART', 'TARGET'].includes(provider)) return json(res, 400, { error: 'bad_request', message: 'Unknown provider' });
    const enabled = !!body?.enabled;
    const affiliateId = body?.affiliateId ? String(body.affiliateId) : null;
    const priority = Number.isFinite(Number(body?.priority)) ? Math.trunc(Number(body.priority)) : 100;
    const linkTemplate = body?.linkTemplate ? String(body.linkTemplate) : null;

    const existing = await prisma.affiliateProviderConfig
      .findFirst({ where: { siteKey, provider: provider as any }, select: { id: true } })
      .catch(() => null);
    if (existing) {
      await prisma.affiliateProviderConfig.update({ where: { id: existing.id }, data: { enabled, affiliateId, priority, linkTemplate } });
    } else {
      await prisma.affiliateProviderConfig.create({ data: { siteKey, provider: provider as any, enabled, affiliateId, priority, linkTemplate } });
    }
    return json(res, 200, { ok: true });
  }

  // Admin: Sites (real API; empty arrays allowed)
  if (path === '/api/admin/sites') {
    if (method === 'GET') {
      const rows = await prisma.site
        .findMany({
          orderBy: [{ enabled: 'desc' }, { code: 'asc' }],
          select: { id: true, code: true, domain: true, enabled: true, currency: true, affiliateTag: true, createdAt: true, updatedAt: true },
        })
        .catch(() => []);
      return json(res, 200, {
        ok: true,
        data: {
          sites: rows.map((s: { id: string; code: string; domain: string; enabled: boolean; currency: string; affiliateTag: string; createdAt: Date; updatedAt: Date }) => ({
            id: s.id,
            code: s.code,
            domain: s.domain,
            enabled: s.enabled,
            currency: s.currency,
            affiliateTag: s.affiliateTag,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
          })),
        },
      });
    }

    if (method === 'POST') {
      const body = (await readJson(req).catch(() => null)) as any;
      const code = String(body?.code ?? '').trim().toUpperCase();
      const domain = String(body?.domain ?? '').trim();
      const currency = String(body?.currency ?? '').trim().toUpperCase();
      const affiliateTag = String(body?.affiliateTag ?? '').trim();
      const enabled = !!body?.enabled;

      if (!/^[A-Z]{2,4}$/.test(code)) return json(res, 400, { error: 'bad_request', message: 'Invalid code (expected US/CA/UK/etc.)' });
      if (!domain) return json(res, 400, { error: 'bad_request', message: 'Domain is required' });
      if (!/^[A-Z]{3}$/.test(currency)) return json(res, 400, { error: 'bad_request', message: 'Invalid currency (expected USD/CAD/GBP/etc.)' });
      if (!affiliateTag) return json(res, 400, { error: 'bad_request', message: 'Affiliate tag is required' });

      await prisma.site.create({ data: { code, domain, enabled, currency, affiliateTag } });
      return json(res, 200, { ok: true });
    }

    return methodNotAllowed(res);
  }

  // Admin: Image intents (backend-only queue; generation handled out-of-band)
  if (path === '/api/admin/image-intents') {
    if (method === 'GET') {
      const status = url.searchParams.get('status')?.toUpperCase() ?? null;
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const take = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.trunc(limit))) : 50;

      const where: any = {};
      if (status && ['PENDING', 'GENERATED', 'FAILED'].includes(status)) where.status = status;

      const rows = await prisma.imageIntent
        .findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true, entityType: true, entityId: true, imageType: true, status: true, createdAt: true },
        })
        .catch(() => []);

      return json(res, 200, {
        ok: true,
        data: {
          intents: rows.map((r: any) => ({
            id: r.id,
            entityType: r.entityType,
            entityId: r.entityId,
            imageType: r.imageType,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
          })),
        },
      });
    }

    if (method === 'POST') {
      const body = (await readJson(req).catch(() => null)) as any;
      const entityType = String(body?.entityType ?? '').trim().toUpperCase();
      const entityId = String(body?.entityId ?? '').trim();
      const imageType = String(body?.imageType ?? '').trim().toUpperCase();

      if (!['DISCOVERY_CANDIDATE', 'RETAIL_PRODUCT'].includes(entityType)) {
        return json(res, 400, { error: 'bad_request', message: 'Invalid entityType' });
      }
      if (!entityId) return json(res, 400, { error: 'bad_request', message: 'entityId is required' });
      if (!['CARD', 'HERO', 'OG'].includes(imageType)) return json(res, 400, { error: 'bad_request', message: 'Invalid imageType' });

      const intent = await prisma.imageIntent.create({
        data: { entityType: entityType as any, entityId, imageType: imageType as any, status: 'PENDING' as any },
        select: { id: true, entityType: true, entityId: true, imageType: true, status: true, createdAt: true },
      });

      return json(res, 200, {
        ok: true,
        data: {
          intent: {
            id: intent.id,
            entityType: intent.entityType,
            entityId: intent.entityId,
            imageType: intent.imageType,
            status: intent.status,
            createdAt: intent.createdAt.toISOString(),
          },
        },
      });
    }

    return methodNotAllowed(res);
  }

  const sitePatchMatch = path.match(/^\/api\/admin\/sites\/([^/]+)$/);
  if (sitePatchMatch) {
    if (method !== 'PATCH') return methodNotAllowed(res);
    const id = decodeURIComponent(sitePatchMatch[1] ?? '');
    const body = (await readJson(req).catch(() => null)) as any;
    const data: any = {};
    if (body?.domain != null) data.domain = String(body.domain).trim();
    if (body?.enabled != null) data.enabled = !!body.enabled;
    if (body?.currency != null) data.currency = String(body.currency).trim().toUpperCase();
    if (body?.affiliateTag != null) data.affiliateTag = String(body.affiliateTag).trim();
    // code is intentionally immutable via PATCH (use POST to create).

    if (data.domain === '') return json(res, 400, { error: 'bad_request', message: 'Domain cannot be empty' });
    if (data.currency != null && !/^[A-Z]{3}$/.test(String(data.currency))) {
      return json(res, 400, { error: 'bad_request', message: 'Invalid currency (expected USD/CAD/GBP/etc.)' });
    }
    if (data.affiliateTag === '') return json(res, 400, { error: 'bad_request', message: 'Affiliate tag cannot be empty' });

    await prisma.site.update({ where: { id }, data });
    return json(res, 200, { ok: true });
  }

  // Admin: Products (real API; empty arrays allowed)
  if (path === '/api/admin/products') {
    if (method !== 'GET') return methodNotAllowed(res);
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const take = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.trunc(limit))) : 50;

    const products = await prisma.product.findMany({
      select: { asin: true, title: true, source: true, updatedAt: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take,
    });

    return json(res, 200, {
      ok: true,
      data: {
        products: products.map((p) => ({
          asin: p.asin,
          title: p.title,
          source: p.source,
          updatedAt: p.updatedAt.toISOString(),
        })),
      },
    });
  }

  // Admin dashboard (real, no fabricated metrics; empty is valid)
  if (path === '/api/admin') {
    if (method !== 'GET') return methodNotAllowed(res);
    const db = await canQueryDb();
    const dbStatus = db.ok ? { status: 'ready' as const } : { status: 'unreachable' as const, message: db.message ?? 'Database unreachable' };

    const now = new Date();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const startOfUtcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const LIVE_STATUSES = ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] as const;
    const exp1h = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const exp6h = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const exp24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [lastIngestion, ingestionFailures24h, aiFailures24h, liveDealsCount, in1h, in6h, in24h, newProductsToday, aiActionsLast24h, clicksToday, clicks7d, alerts] =
      await Promise.all([
        prisma.ingestionRun
          .findFirst({ where: { finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' }, select: { finishedAt: true, status: true, error: true } })
          .catch(() => null),
        prisma.ingestionRun.count({ where: { status: 'FAILURE', startedAt: { gte: since24h, lte: now } } }).catch(() => 0),
        prisma.aIActionLog.count({ where: { status: 'FAILURE', startedAt: { gte: since24h, lte: now } } }).catch(() => 0),
        prisma.deal.count({ where: { approved: true, suppressed: false, status: { in: LIVE_STATUSES as any }, expiresAt: { gt: now } } }).catch(() => 0),
        prisma.deal.count({ where: { approved: true, suppressed: false, status: { in: LIVE_STATUSES as any }, expiresAt: { gt: now, lte: exp1h } } }).catch(() => 0),
        prisma.deal.count({ where: { approved: true, suppressed: false, status: { in: LIVE_STATUSES as any }, expiresAt: { gt: now, lte: exp6h } } }).catch(() => 0),
        prisma.deal.count({ where: { approved: true, suppressed: false, status: { in: LIVE_STATUSES as any }, expiresAt: { gt: now, lte: exp24h } } }).catch(() => 0),
        prisma.product.count({ where: { createdAt: { gte: startOfUtcDay, lte: now } } }).catch(() => 0),
        prisma.aIActionLog.count({ where: { startedAt: { gte: since24h, lte: now } } }).catch(() => 0),
        prisma.clickEvent.count({ where: { kind: 'AFFILIATE_OUTBOUND', occurredAt: { gte: startOfUtcDay, lte: now } } }).catch(() => 0),
        prisma.clickEvent.count({ where: { kind: 'AFFILIATE_OUTBOUND', occurredAt: { gte: since7d, lte: now } } }).catch(() => 0),
        prisma.systemAlert
          .findMany({ where: { resolvedAt: null, noisy: false }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, type: true, message: true } })
          .catch((): Array<{ id: string; type: string; message: string }> => []),
      ]);

    const lastIngestionAgeMinutes =
      lastIngestion?.finishedAt ? Math.max(0, Math.floor((now.getTime() - lastIngestion.finishedAt.getTime()) / 60000)) : null;

    return json(res, 200, {
      db: dbStatus,
      health: {
        lastIngestion: lastIngestion
          ? { finishedAt: lastIngestion.finishedAt?.toISOString() ?? null, status: lastIngestion.status, error: lastIngestion.error ?? null }
          : null,
        lastIngestionAgeMinutes,
        ingestionFailures24h,
        aiFailures24h,
      },
      metrics: {
        liveDealsCount,
        expiring: { in1h, in6h, in24h },
        newProductsToday,
        aiActionsLast24h,
        affiliateClicks: { today: clicksToday, last7d: clicks7d },
        alerts: alerts.map((a: { id: string; type: string; message: string }) => ({ id: a.id, type: a.type, message: a.message })),
      },
    });
  }

  // Deals list (real; empty arrays allowed)
  if (path === '/api/admin/deals') {
    if (method !== 'GET') return methodNotAllowed(res);
    const now = new Date();
    const limitRaw = Number(url.searchParams.get('limit') ?? '50');
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;
    const cursor = url.searchParams.get('cursor');
    const status = url.searchParams.get('status') ?? 'all';
    const window = url.searchParams.get('window') ?? 'all';
    const site = url.searchParams.get('site') ?? 'all';
    const category = (url.searchParams.get('category') ?? '').trim();
    const source = url.searchParams.get('source') ?? 'all';
    const q = (url.searchParams.get('q') ?? '').trim();

    const LIVE_STATUSES = ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] as const;
    const EXPIRING_STATUSES = ['EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] as const;

    const where: any = { approved: true };
    if (source !== 'all') where.source = source;

    if (status === 'paused') where.suppressed = true;
    if (status === 'live') {
      where.suppressed = false;
      where.status = { in: LIVE_STATUSES as any };
      where.expiresAt = { gt: now };
    }
    if (status === 'expiring') {
      where.suppressed = false;
      where.status = { in: EXPIRING_STATUSES as any };
      where.expiresAt = { gt: now };
    }
    if (status === 'expired') {
      where.OR = [{ status: 'EXPIRED' }, { expiresAt: { lte: now } }];
    }
    if (status === 'scheduled') {
      where.suppressed = false;
      where.expiresAt = { gt: now };
      // Best-effort: treat deals with only future placements as "scheduled".
      where.placements = { some: { enabled: true, startsAt: { gt: now } }, none: { enabled: true, startsAt: { lte: now }, endsAt: { gt: now } } };
    }

    if (window !== 'all') {
      const ms =
        window === '1h' ? 1 * 60 * 60 * 1000 : window === '6h' ? 6 * 60 * 60 * 1000 : window === '24h' ? 24 * 60 * 60 * 1000 : null;
      if (ms != null) {
        const until = new Date(now.getTime() + ms);
        where.expiresAt = { ...(where.expiresAt ?? {}), gt: now, lte: until };
      }
    }

    if (site !== 'all') {
      where.product = { ...(where.product ?? {}), tags: { has: `site:${site}` } };
    }
    if (category) {
      where.product = {
        ...(where.product ?? {}),
        OR: [{ categoryOverride: category }, { category }],
      };
    }
    if (q) {
      where.product = {
        ...(where.product ?? {}),
        OR: [...(((where.product ?? {}) as any).OR ?? []), { asin: { contains: q } }, { title: { contains: q, mode: 'insensitive' } }],
      };
    }

    const deals = await prisma.deal.findMany({
      where,
      select: {
        id: true,
        source: true,
        status: true,
        suppressed: true,
        expiresAt: true,
        discountPercent: true,
        currentPriceCents: true,
        oldPriceCents: true,
        currency: true,
        lastEvaluatedAt: true,
        product: { select: { asin: true, title: true, imageUrl: true, category: true, categoryOverride: true, tags: true } },
        placements: { select: { type: true, enabled: true, startsAt: true, endsAt: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const nextCursor = deals.length > limit ? deals[limit]!.id : null;
    const page = deals.slice(0, limit);

    function dealStateLabel(d: any): 'live' | 'expiring' | 'scheduled' | 'paused' | 'expired' {
      if (d.suppressed) return 'paused';
      if (d.status === 'EXPIRED' || d.expiresAt <= now) return 'expired';
      if (EXPIRING_STATUSES.includes(d.status)) return 'expiring';
      // If it has no active placements but has future placements, consider scheduled.
      const hasActivePlacement = d.placements.some((p: any) => p.enabled && p.startsAt <= now && p.endsAt > now);
      const hasFuturePlacement = d.placements.some((p: any) => p.enabled && p.startsAt > now);
      if (!hasActivePlacement && hasFuturePlacement) return 'scheduled';
      return 'live';
    }

    function timeWindowLabel(expiresAt: Date): '1h' | '6h' | '24h' | 'later' | 'expired' {
      if (expiresAt <= now) return 'expired';
      const mins = (expiresAt.getTime() - now.getTime()) / 60000;
      if (mins <= 60) return '1h';
      if (mins <= 360) return '6h';
      if (mins <= 1440) return '24h';
      return 'later';
    }

    const outDeals = page.map((d) => {
      const activePlacements = d.placements.filter((p: any) => p.enabled && p.startsAt <= now && p.endsAt > now).map((p: any) => String(p.type));
      const scheduledPlacements = d.placements.filter((p: any) => p.enabled && p.startsAt > now && p.endsAt > p.startsAt).map((p: any) => String(p.type));
      const visibleSites = (d.product.tags ?? []).filter((t: string) => t.startsWith('site:')).map((t: string) => t.slice('site:'.length));
      const priority = d.suppressed ? 'suppressed' : activePlacements.some((t: string) => ['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'].includes(t)) ? 'featured' : 'normal';

      return {
        id: d.id,
        source: d.source,
        status: d.status,
        suppressed: d.suppressed,
        expiresAt: d.expiresAt.toISOString(),
        discountPercent: d.discountPercent ?? null,
        currentPriceCents: d.currentPriceCents,
        oldPriceCents: d.oldPriceCents ?? null,
        currency: d.currency,
        lastEvaluatedAt: d.lastEvaluatedAt ? d.lastEvaluatedAt.toISOString() : null,
        product: {
          asin: d.product.asin,
          title: d.product.title,
          imageUrl: d.product.imageUrl ?? null,
          category: d.product.category ?? null,
          categoryOverride: d.product.categoryOverride ?? null,
          tags: d.product.tags ?? [],
        },
        placements: d.placements.map((p: any) => ({
          type: String(p.type),
          enabled: p.enabled,
          startsAt: p.startsAt.toISOString(),
          endsAt: p.endsAt.toISOString(),
        })),
        derived: {
          dealStateLabel: dealStateLabel(d),
          timeWindow: timeWindowLabel(d.expiresAt),
          priority,
          visibleSites,
          activePlacementTypes: activePlacements,
          scheduledPlacementTypes: scheduledPlacements,
        },
      };
    });

    return json(res, 200, {
      now: now.toISOString(),
      nextCursor,
      deals: outDeals,
      sites: sites.map((s) => ({ key: s.key, enabled: s.enabled })),
    });
  }

  // Deal metrics (real where possible; empty/0 is valid when no tracking exists)
  const dealMetricsMatch = path.match(/^\/api\/admin\/deals\/([^/]+)\/metrics$/);
  if (dealMetricsMatch) {
    if (method !== 'GET') return methodNotAllowed(res);
    const dealId = decodeURIComponent(dealMetricsMatch[1] ?? '');
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const clicks = await prisma.clickEvent.count({ where: { dealId, occurredAt: { gte: since } } }).catch(() => 0);
    return json(res, 200, {
      since: since.toISOString(),
      impressions: 0,
      clicks,
      ctr: 0,
      bySite: [],
      byPartner: [],
      aiNotes: { available: false, note: 'Unavailable' },
    });
  }

  // Deal actions (real)
  if (method === 'POST' && path === '/api/admin/deals/pause') {
    const body = (await readJson(req).catch(() => null)) as any;
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : [];
    const r = await prisma.deal.updateMany({ where: { id: { in: ids } }, data: { suppressed: true } }).catch(() => ({ count: 0 }));
    return json(res, 200, { ok: true, message: `Paused ${r.count} deal(s)` });
  }
  if (method === 'POST' && path === '/api/admin/deals/resume') {
    const body = (await readJson(req).catch(() => null)) as any;
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : [];
    const r = await prisma.deal.updateMany({ where: { id: { in: ids } }, data: { suppressed: false } }).catch(() => ({ count: 0 }));
    return json(res, 200, { ok: true, message: `Resumed ${r.count} deal(s)` });
  }
  if (method === 'POST' && path === '/api/admin/deals/force-expire') {
    const body = (await readJson(req).catch(() => null)) as any;
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : [];
    const now = new Date();
    const r = await prisma.deal
      .updateMany({ where: { id: { in: ids } }, data: { status: 'EXPIRED', expiresAt: now } })
      .catch(() => ({ count: 0 }));
    return json(res, 200, { ok: true, message: `Expired ${r.count} deal(s)` });
  }
  if (method === 'POST' && path === '/api/admin/deals/reevaluate') {
    const body = (await readJson(req).catch(() => null)) as any;
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : [];
    const r = await prisma.deal
      .updateMany({ where: { id: { in: ids } }, data: { lastEvaluatedAt: null, aiEvaluatedAt: null } })
      .catch(() => ({ count: 0 }));
    return json(res, 200, { ok: true, message: `Queued ${r.count} deal(s) for re-evaluation` });
  }
  if (method === 'POST' && path === '/api/admin/deals/feature') {
    const body = (await readJson(req).catch(() => null)) as any;
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : [];
    const r = await prisma.deal.updateMany({ where: { id: { in: ids } }, data: { aiFeatured: true } }).catch(() => ({ count: 0 }));
    return json(res, 200, { ok: true, message: `Featured ${r.count} deal(s)` });
  }

  // Never 404 on admin surfaces: future-proof unknown admin GET endpoints.
  if (path.startsWith('/api/admin/') && method === 'GET') {
    return json(res, 200, { ok: true, data: {} });
  }

  return notFound(res);
}

export { handle };

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => json(res, 500, { error: 'internal_error', message: safeError(e) }));
});

// IMPORTANT: do not auto-listen in serverless environments (Vercel imports this module).
if (!process.env.VERCEL && process.env.API_DISABLE_LISTEN !== 'true') {
  server.listen(3005, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log('[api] listening on http://localhost:3005');
  });
}

