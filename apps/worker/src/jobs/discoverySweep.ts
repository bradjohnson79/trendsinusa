import { prisma } from '@trendsinusa/db';
import { getServerEnv } from '@trendsinusa/shared';
import { getSiteByKey } from '@trendsinusa/shared/server';

import { generateShortText } from '../ai/openai.js';
import { perplexityResearch } from '../ai/perplexity.js';
import { ensurePostingItemForDiscovery } from '../posting/lifecycle.js';

const PROMPT_VERSION = 'discovery-sweep-v1';

type Retailer = 'AMAZON' | 'WALMART' | 'TARGET' | 'BEST_BUY';
type Source = 'PERPLEXITY' | 'OPENAI' | 'MIXED';

type NormalizedCandidate = {
  title: string;
  category: string | null;
  description: string | null;
  imageQuery: string | null;
  outboundUrl: string;
  confidenceScore: number | null;
};

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeTitleKey(s: string) {
  return normalizeWhitespace(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseJsonArray<T>(raw: string): T[] {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  const json = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw;
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
  return parsed as T[];
}

function clampConfidence(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function validateCandidate(x: any, categoryHint: string): NormalizedCandidate | null {
  const title = normalizeWhitespace(String(x?.title ?? ''));
  if (!title) return null;

  const outboundUrl = String(x?.outboundUrl ?? x?.url ?? '').trim();
  if (!/^https?:\/\//i.test(outboundUrl)) return null;

  const description = x?.description != null ? normalizeWhitespace(String(x.description)) : null;
  const imageQuery = x?.imageQuery != null ? normalizeWhitespace(String(x.imageQuery)) : null;

  const categoryRaw = x?.category != null ? normalizeWhitespace(String(x.category)) : '';
  const category = categoryRaw ? categoryRaw : categoryHint;

  const confidenceScore = clampConfidence(x?.confidenceScore);

  // Hard guardrails: discovery layer must not carry prices or affiliate fields.
  // (We can't fully “prove” absence in arbitrary strings, but we at least reject obvious currency markers.)
  const joined = `${title} ${description ?? ''}`.toLowerCase();
  if (joined.includes('$') || joined.includes('usd') || joined.includes('price')) return null;
  if (joined.includes('affiliate') || joined.includes('promo code') || joined.includes('coupon')) return null;

  return {
    title,
    category: category || null,
    description: description || null,
    imageQuery: imageQuery || null,
    outboundUrl,
    confidenceScore,
  };
}

function retailerLabel(r: Retailer) {
  return r === 'BEST_BUY' ? 'Best Buy' : r.charAt(0) + r.slice(1).toLowerCase();
}

function parseCsvEnv(key: string): string[] {
  const raw = process.env[key] ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function runDiscoverySweep(params: { siteKey?: string } = {}) {
  const env = getServerEnv();
  const siteKey = params.siteKey ?? 'trendsinusa';

  if (String(process.env.DISCOVERY_ENABLED ?? 'false').toLowerCase() !== 'true') {
    return { ok: true as const, skipped: true as const, reason: 'DISCOVERY_ENABLED=false' };
  }

  // Gate behind automationEnabled (no surprise background behavior)
  const cfg = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { automationEnabled: true } }).catch(() => null);
  if (!cfg?.automationEnabled) {
    return { ok: true as const, skipped: true as const, reason: 'automationEnabled=false' };
  }

  const retailersEnv = parseCsvEnv('DISCOVERY_RETAILERS').map((s) => s.toUpperCase());
  const retailers: Retailer[] = (retailersEnv.length ? retailersEnv : ['AMAZON', 'WALMART', 'TARGET', 'BEST_BUY'])
    .filter((r): r is Retailer => ['AMAZON', 'WALMART', 'TARGET', 'BEST_BUY'].includes(r as any));

  const site = await getSiteByKey(siteKey);
  const categoriesEnv = parseCsvEnv('DISCOVERY_CATEGORIES');
  const categories = categoriesEnv.length
    ? categoriesEnv
    : (site?.defaultCategories?.length ? site.defaultCategories : ['Electronics', 'Home', 'Kitchen', 'Fitness']).slice(0, 8);

  const limitPerRetailerRaw = Number(process.env.DISCOVERY_LIMIT_PER_RETAILER ?? 10);
  const limitPerRetailer = Number.isFinite(limitPerRetailerRaw) ? Math.max(5, Math.min(10, Math.trunc(limitPerRetailerRaw))) : 10;

  const now = new Date();
  const expiresInMs = 72 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + expiresInMs);

  const perplexityModel = env.AI_RESEARCH_MODEL; // uses the same env shape as other research flows
  const openaiModel = env.AI_FINAL_MODEL;

  const created: string[] = [];
  const updated: string[] = [];
  const errors: string[] = [];

  for (const retailer of retailers) {
    // Fetch recent candidates for this retailer to dedupe (bounded)
    const existing = await prisma.discoveryCandidate
      .findMany({
        where: { retailer: retailer as any },
        orderBy: { discoveredAt: 'desc' },
        take: 400,
        select: { id: true, title: true },
      })
      .catch(() => []);
    const existingByKey = new Map(existing.map((r) => [normalizeTitleKey(r.title), r.id]));

    const perRetailerCandidates: NormalizedCandidate[] = [];

    for (const category of categories) {
      if (perRetailerCandidates.length >= limitPerRetailer) break;

      // 1) Perplexity query (no scraping, no retailer APIs)
      const user = `What products are trending right now on ${retailerLabel(retailer)} in ${category}?

Return a concise list of candidate products with URLs to public pages if possible.
Rules:
- No prices, no discounts, no affiliate links
- No scraping instructions
- If unsure about a URL, omit it.
Format: plain text list is fine.`;

      let research = '';
      try {
        research = await perplexityResearch({
          model: perplexityModel,
          system:
            'You are a product discovery assistant. Provide neutral, non-commercial discovery candidates. Do not include prices, deals, or affiliate language.',
          user,
          maxTokens: 700,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`perplexity_failed:${retailer}:${category}:${msg}`);
        continue;
      }

      // 2) Normalize via OpenAI (strict JSON)
      const normalizeUser = `Normalize the following discovery research into a JSON array of 0..10 candidates.

Context:
- Retailer: ${retailer}
- Category: ${category}

Rules:
- Do NOT include prices, discounts, deal claims, or affiliate language.
- Do NOT include ASIN/SKU requirements.
- outboundUrl must be a plain https URL if present; otherwise omit the item.
- Keep title short and normalized (no emojis, no promo words).
- confidenceScore must be 0..1 (use null if uncertain).

Return JSON only (no markdown), shape:
[
  {
    \"title\": string,
    \"category\": string,
    \"description\": string|null,
    \"imageQuery\": string|null,
    \"outboundUrl\": string,
    \"confidenceScore\": number|null
  }
]

Research:
${research}`;

      let normalizedRaw = '';
      try {
        normalizedRaw = await generateShortText({
          model: openaiModel,
          system:
            'You are a strict JSON normalizer for discovery candidates. Return only valid JSON. Do not fabricate prices or deals. Do not include affiliate tracking.',
          user: normalizeUser,
          temperature: 0,
          maxOutputTokens: 900,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`openai_normalize_failed:${retailer}:${category}:${msg}`);
        continue;
      }

      let normalized: any[] = [];
      try {
        normalized = parseJsonArray<any>(normalizedRaw);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`openai_json_parse_failed:${retailer}:${category}:${msg}`);
        continue;
      }

      for (const item of normalized) {
        if (perRetailerCandidates.length >= limitPerRetailer) break;
        const v = validateCandidate(item, category);
        if (!v) continue;
        const key = normalizeTitleKey(v.title);
        if (!key) continue;
        if (existingByKey.has(key)) continue;
        if (perRetailerCandidates.some((c) => normalizeTitleKey(c.title) === key)) continue;
        perRetailerCandidates.push(v);
      }
    }

    // 3) Persist with dedupe by normalized title + retailer (best-effort)
    for (const c of perRetailerCandidates.slice(0, limitPerRetailer)) {
      const key = normalizeTitleKey(c.title);
      const existingId = existingByKey.get(key) ?? null;
      if (existingId) {
        await prisma.discoveryCandidate.update({
          where: { id: existingId },
          data: {
            title: c.title,
            category: c.category,
            description: c.description,
            imageQuery: c.imageQuery,
            outboundUrl: c.outboundUrl,
            confidenceScore: c.confidenceScore,
            source: 'MIXED' as Source as any,
            status: 'ACTIVE' as any,
            discoveredAt: now,
            expiresAt,
          },
        });
        updated.push(existingId);

        // Rediscovery can generate a new post: if the previously linked post is expired,
        // unlink it (retain the post for audit) so a new post may be created later.
        const expiredPost = await prisma.unaffiliatedPost
          .findFirst({ where: { discoveryCandidateId: existingId, status: 'EXPIRED' }, select: { id: true } })
          .catch(() => null);
        if (expiredPost) {
          await prisma.unaffiliatedPost.update({ where: { id: expiredPost.id }, data: { discoveryCandidateId: null } }).catch(() => null);
        }

        await ensurePostingItemForDiscovery({
          discoveryCandidateId: existingId,
          retailer: retailer as any,
          discoveredAt: now,
          category: c.category ?? null,
          confidenceScore: c.confidenceScore ?? null,
        }).catch(() => null);
      } else {
        const row = await prisma.discoveryCandidate.create({
          data: {
            title: c.title,
            retailer: retailer as any,
            category: c.category,
            description: c.description,
            imageQuery: c.imageQuery,
            outboundUrl: c.outboundUrl,
            confidenceScore: c.confidenceScore,
            source: 'MIXED' as Source as any,
            status: 'ACTIVE' as any,
            discoveredAt: now,
            expiresAt,
          },
          select: { id: true },
        });
        created.push(row.id);

        await ensurePostingItemForDiscovery({
          discoveryCandidateId: row.id,
          retailer: retailer as any,
          discoveredAt: now,
          category: c.category ?? null,
          confidenceScore: c.confidenceScore ?? null,
        }).catch(() => null);
      }
    }
  }

  // 4) Auto-expire after 72h if not rediscovered
  const expired = await prisma.discoveryCandidate.updateMany({
    where: { status: 'ACTIVE', expiresAt: { not: null, lt: now } },
    data: { status: 'STALE' as any },
  });

  // Minimal audit marker (non-commercial)
  await prisma.systemAlert
    .create({
      data: {
        type: 'SYSTEM',
        severity: errors.length ? 'WARNING' : 'INFO',
        noisy: false,
        message: `[discovery] sweep complete v=${PROMPT_VERSION} created=${created.length} updated=${updated.length} expired=${expired.count} errors=${errors.length}`,
      },
    })
    .catch(() => null);

  return {
    ok: true as const,
    skipped: false as const,
    created,
    updated,
    expired: expired.count,
    errors,
    meta: { promptVersion: PROMPT_VERSION, retailers, categories, limitPerRetailer, models: { perplexity: perplexityModel, openai: openaiModel } },
  };
}

