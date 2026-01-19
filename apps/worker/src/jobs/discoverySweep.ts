import { prisma } from '@trendsinusa/db';
import { getServerEnv } from '@trendsinusa/shared';
import { getSiteByKey } from '@trendsinusa/shared/server';

import { perplexityResearch } from '../ai/perplexity.js';
import { generateShortDescription, generateThumbnailDataUrl, scoreConfidenceNano, verifyOutboundLink } from '../enrichment/postEnrichment.js';
import { ensurePostingItemForDiscovery } from '../posting/lifecycle.js';
import { getTodayUTC } from '../utils/time.js';

const PROMPT_VERSION = 'discovery-sweep-v1';

type Retailer = 'AMAZON' | 'WALMART' | 'TARGET' | 'BEST_BUY';
type Source = 'PERPLEXITY' | 'MIXED';

type NormalizedCandidate = {
  title: string;
  category: string | null;
  description: string | null;
  imageQuery: string | null;
  outboundUrl: string;
  confidenceScore: number | null;
  sourcePublishedAt: string | null;
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

  // Discovery is DB-gated (fail-closed). .env may be used as an emergency hard stop only.
  const cfg = await prisma.automationConfig
    .findUnique({ where: { siteKey }, select: { discoveryEnabled: true, automationEnabled: true } })
    .catch(() => null);
  if (!cfg?.discoveryEnabled) {
    return { ok: true as const, skipped: true as const, reason: 'discovery_disabled' };
  }
  if (String(process.env.DISCOVERY_FORCE_DISABLED ?? 'false').toLowerCase() === 'true') {
    return { ok: true as const, skipped: true as const, reason: 'force_disabled' };
  }

  // Gate behind automationEnabled (no surprise background behavior)
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

  const today = getTodayUTC();
  const freshnessWindowHours = 24;
  const freshestAllowed = new Date(today.getTime() - freshnessWindowHours * 60 * 60 * 1000);

  function parseSourcePublishedAt(v: string | null): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return d.getTime() != d.getTime() ? null : d;
  }

  function freshnessScoreFrom(spa: Date | null): number | null {
    if (!spa) return null;
    const ageHours = (today.getTime() - spa.getTime()) / 36e5;
    const clamped = Math.max(0, Math.min(1, 1 - Math.max(0, ageHours) / freshnessWindowHours));
    return clamped;
  }

  const perplexityModel = env.AI_RESEARCH_MODEL; // uses the same env shape as other research flows
  // Permanent policy: nano-only short outputs; no OpenAI normalization of discovery results.

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

      // 2) Parse best-effort candidates from Perplexity output (no OpenAI normalization).
      // We accept any line containing a URL; title is the surrounding text.
      const urlRe = new RegExp('https?://[^\\\\s)\\\\]]+', 'g');
      const lines = String(research || '')
        .split(/\\r?\\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        if (perRetailerCandidates.length >= limitPerRetailer) break;
        const urls = [...line.matchAll(urlRe)].map((m) => m[1]).filter(Boolean);
        if (!urls.length) continue;

        const title = (normalizeWhitespace(line.replace(urlRe, '').replace(/^[-*•]+\\s*/, '').trim()) || urls[0] || '').trim();
        if (!title) continue;
        const joined = title.toLowerCase();
        if (joined.includes('$') || joined.includes('usd') || joined.includes('price')) continue;
        if (joined.includes('affiliate') || joined.includes('promo code') || joined.includes('coupon')) continue;

        const outboundUrl = urls[0] ?? '';
        if (!outboundUrl) continue;
        if (!(outboundUrl.startsWith('http://') || outboundUrl.startsWith('https://'))) continue;

        const v: NormalizedCandidate = {
          title,
          category: category ?? null,
          description: null,
          imageQuery: title,
          outboundUrl,
          confidenceScore: null,
          sourcePublishedAt: null,
        };

        const key = normalizeTitleKey(v.title);
        if (!key) continue;
        if (existingByKey.has(key)) continue;
        if (perRetailerCandidates.some((c) => normalizeTitleKey(c.title) === key)) continue;
        perRetailerCandidates.push(v);
      }
    }

    // 3) Persist with dedupe by normalized title + retailer (best-effort)
    for (const c of perRetailerCandidates.slice(0, limitPerRetailer)) {
      // Freshness enforcement (UTC anchored): reject before any DB write.
      const spa = parseSourcePublishedAt(c.sourcePublishedAt ?? null);
      if (spa) {
        const ageHours = (today.getTime() - spa.getTime()) / 36e5;
        if (ageHours > freshnessWindowHours) {
          continue;
        }
      }

      // Always verify link before storing. Fail-closed.
      const v = await verifyOutboundLink(c.outboundUrl);
      if (!v.isActive) {
        // Hard denial: never eligible for rendering. Mark existing rows as DENIED/REMOVED for audit.
        const key = normalizeTitleKey(c.title);
        const existingId = existingByKey.get(key) ?? null;
        if (existingId) {
          await prisma.discoveryCandidate
            .update({
              where: { id: existingId },
              data: {
                approvalStatus: 'DENIED' as any,
                status: 'REMOVED' as any,
                linkStatus: v.status as any,
                lastCheckedAt: now,
                expiresAt: now,
              },
            })
            .catch(() => null);
        }
        continue;
      }

      const categoryKey = c.category ?? 'General';
      const confidenceScore = (await scoreConfidenceNano({ title: c.title, category: categoryKey, retailer: String(retailer) })) ?? null;
      const shortDescription = await generateShortDescription({ title: c.title, category: categoryKey, retailer: String(retailer) });
      const thumb = await generateThumbnailDataUrl({
        title: c.title,
        category: categoryKey,
        shortDescription,
        confidenceScore,
        outboundUrl: c.outboundUrl,
      });
      const approvalStatus = thumb.url ? ('APPROVED' as const) : ('TEMP_APPROVED' as const);

      const fs = freshnessScoreFrom(spa);

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
            confidenceScore,
            sourcePublishedAt: spa,
            freshnessScore: fs,
            isFresh: true,
            approvalStatus,
            shortDescription: shortDescription ?? null,
            thumbnailUrl: thumb.url,
            thumbnailGeneratedAt: now,
            thumbnailSource: thumb.source,
            thumbnailInputHash: thumb.inputHash,
            linkStatus: v.status as any,
            lastCheckedAt: now,
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
          confidenceScore,
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
            confidenceScore,
            sourcePublishedAt: spa,
            freshnessScore: fs,
            isFresh: true,
            approvalStatus,
            shortDescription: shortDescription ?? null,
            thumbnailUrl: thumb.url,
            thumbnailGeneratedAt: now,
            thumbnailSource: thumb.source,
            thumbnailInputHash: thumb.inputHash,
            linkStatus: v.status as any,
            lastCheckedAt: now,
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
          confidenceScore,
        }).catch(() => null);
      }
    }
  }

  // 4) Auto-expire after 72h if not rediscovered
  const expired = await prisma.discoveryCandidate.updateMany({
    where: { status: 'ACTIVE', expiresAt: { not: null, lt: now } },
    data: { status: 'STALE' as any },
  });

  // 5) Best-effort enrichment (non-blocking callers; bounded work)
  // - shortDescription (1 sentence, max 20 words; gpt-4.1-nano)
  // - thumbnailUrl (real og:image if possible, otherwise product-specific generated; SVG→Sharp)
  // - linkStatus (HTTP + nano edge-case) — DEAD => hard denial (REMOVED)
  const idsToEnrich = Array.from(new Set([...created, ...updated])).slice(0, 30);
  const backfill = await prisma.discoveryCandidate
    .findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ shortDescription: null }, { thumbnailUrl: null }, { AND: [{ linkStatus: 'UNKNOWN' as any }, { lastCheckedAt: null }] }],
      },
      orderBy: { discoveredAt: 'desc' },
      take: 10,
      select: { id: true },
    })
    .catch(() => [] as Array<{ id: string }>);
  const moreIds = backfill.map((r) => r.id);
  const allToEnrich = Array.from(new Set([...idsToEnrich, ...moreIds])).slice(0, 30);

  for (const id of allToEnrich) {
    try {
      const row = await prisma.discoveryCandidate
        .findUnique({
          where: { id },
          select: {
            id: true,
            title: true,
            retailer: true,
            category: true,
            description: true,
            outboundUrl: true,
            confidenceScore: true,
            approvalStatus: true,
            shortDescription: true,
            thumbnailUrl: true,
            thumbnailInputHash: true,
            linkStatus: true,
            lastCheckedAt: true,
          },
        })
        .catch(() => null);
      if (!row) continue;

      const patch: any = {};

      if (!row.shortDescription) {
        // Prefer an existing description if present; keep it short and neutral.
        const fromDesc = row.description ? row.description.split(/[.!?]\s/)[0]?.trim() : '';
        const maybe = fromDesc ? fromDesc.split(/\s+/).slice(0, 20).join(' ') : '';
        const ai = maybe
          ? maybe
          : await generateShortDescription({
              title: row.title,
              category: row.category ?? 'General',
              retailer: String(row.retailer),
            });
        if (ai) patch.shortDescription = ai;
      }

      const shouldVerify = row.lastCheckedAt == null || now.getTime() - new Date(row.lastCheckedAt).getTime() >= 2 * 60 * 60 * 1000;
      if (shouldVerify) {
        const r = await verifyOutboundLink(row.outboundUrl);
        patch.linkStatus = r.status;
        patch.lastCheckedAt = new Date();
        if (!r.isActive) {
          // HARD DENIAL: remove from live surfaces.
          patch.approvalStatus = 'DENIED';
          patch.status = 'REMOVED';
          patch.expiresAt = new Date();
        }
      }

      if (!patch.status && (!row.thumbnailUrl || !row.thumbnailInputHash || row.approvalStatus === 'TEMP_APPROVED')) {
        const t = await generateThumbnailDataUrl({
          title: row.title,
          category: row.category ?? null,
          shortDescription: row.shortDescription ?? row.description ?? null,
          confidenceScore: row.confidenceScore ?? null,
          outboundUrl: row.outboundUrl,
        });
        patch.thumbnailUrl = t.url;
        patch.thumbnailGeneratedAt = new Date();
        patch.thumbnailSource = t.source;
        patch.thumbnailInputHash = t.inputHash;
        patch.approvalStatus = t.url ? 'APPROVED' : 'TEMP_APPROVED';
      }

      if (Object.keys(patch).length) {
        await prisma.discoveryCandidate.update({ where: { id: row.id }, data: patch });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`enrich_failed:${id}:${msg}`);
    }
  }

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
    meta: { promptVersion: PROMPT_VERSION, retailers, categories, limitPerRetailer, models: { perplexity: perplexityModel } },
  };
}

