import { prisma } from '@trendsinusa/db';
import type { DiscoveryCandidateRetailer } from '@prisma/client';
import { generateShortText } from '../ai/openai.js';
import { deriveHeroContextFromPost, generateHeroImageDataUrl, generateShortDescription, generateThumbnailDataUrl, verifyLink } from '../enrichment/postEnrichment.js';
import { isUnaffiliatedAutoPublishEnabled } from '../ingestion/gate.js';
import { expireUnaffiliatedPosts } from '../maintenance/unaffiliatedPosts.js';
import { getTodayUTC } from '../utils/time.js';

function safeSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function containsProhibitedLanguage(s: string) {
  const t = s.toLowerCase();
  const bad = [
    '$',
    'usd',
    'price',
    'discount',
    'deal',
    'coupon',
    'promo',
    'limited time',
    'buy now',
    'shop now',
    'best price',
    'save money',
    'save big',
    'cheapest',
    'lowest price',
    'bargain',
    'must buy',
    'affiliate',
    'commission',
  ];
  return bad.some((b) => t.includes(b));
}

function impliesEndorsement(s: string) {
  const t = s.toLowerCase();
  const bad = [
    'we recommend',
    'our recommendation',
    'editor\'s pick',
    'editors pick',
    'must-have',
    'must have',
    'highly recommend',
    'top pick',
    'best in class',
    'the best',
    'guaranteed',
  ];
  return bad.some((b) => t.includes(b));
}

function hasRequiredSectionsMarkdown(body: string) {
  const t = body.toLowerCase();
  const required = ['what it is', "why it’s trending", "why it's trending", 'common use cases', 'things to consider'];
  // We accept either apostrophe variant for "it's".
  const okWhat = t.includes('what it is');
  const okWhy = t.includes("why it's trending") || t.includes("why it’s trending");
  const okUse = t.includes('common use cases');
  const okConsider = t.includes('things to consider');
  return okWhat && okWhy && okUse && okConsider;
}

type PostJson = {
  title: string;
  summary: string;
  body: string; // markdown
};

function parseJsonObject<T>(raw: string): T {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const json = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw;
  return JSON.parse(json) as T;
}

async function uniqueSlug(base: string): Promise<string> {
  const root = safeSlug(base) || 'post';
  let slug = root;
  for (let i = 0; i < 50; i++) {
    const exists = await prisma.unaffiliatedPost.findUnique({ where: { slug }, select: { id: true } }).catch(() => null);
    if (!exists) return slug;
    slug = `${root}-${i + 2}`;
  }
  return `${root}-${Date.now()}`;
}

export async function runUnaffiliatedPostGeneration(params: { limit?: number } = {}) {
  const siteKey = 'trendsinusa';
  const cfg = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { automationEnabled: true } }).catch(() => null);
  if (!cfg?.automationEnabled) return { ok: true as const, skipped: true as const, reason: 'automation_disabled' };

  const okToPublish = await isUnaffiliatedAutoPublishEnabled({ siteKey });
  if (!okToPublish) return { ok: true as const, skipped: true as const, reason: 'unaffiliated_auto_publish_disabled' };

  const limit = params.limit ?? 10;
  const now = new Date();

  // Expire old posts opportunistically each run (kept for audit).
  const expired = await expireUnaffiliatedPosts(now);

  // Best-effort backfill for existing published posts missing enrichment.
  // (Bounded; must not block publishing.)
  const postsToBackfill = await prisma.unaffiliatedPost
    .findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { shortDescription: null },
          { thumbnailUrl: null },
          { heroImageUrl: null },
          { AND: [{ linkStatus: 'UNKNOWN' as any }, { lastCheckedAt: null }] },
        ],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        title: true,
        retailer: true,
        category: true,
        summary: true,
        body: true,
        outboundUrl: true,
        discoveryCandidateId: true,
        shortDescription: true,
        thumbnailUrl: true,
        linkStatus: true,
        lastCheckedAt: true,
        heroImageUrl: true,
      },
    })
    .catch(() => [] as any[]);
  for (const p of postsToBackfill) {
    try {
      const patch: any = {};
      if (!p.shortDescription) {
        const fromSummary = p.summary ? String(p.summary).split(/[.!?]\s/)[0]?.trim() : '';
        const maybe = fromSummary ? fromSummary.split(/\s+/).slice(0, 20).join(' ') : '';
        const ai = maybe ? maybe : await generateShortDescription({ title: p.title, category: p.category ?? 'General', retailer: String(p.retailer) });
        if (ai) patch.shortDescription = ai;
      }
      if (!p.thumbnailUrl) {
        const t = await generateThumbnailDataUrl({ title: p.title, category: p.category ?? null });
        patch.thumbnailUrl = t.url;
        patch.thumbnailGeneratedAt = new Date();
        patch.thumbnailSource = t.source;
      }
      if (!p.heroImageUrl) {
        const minRaw = Number(process.env.HERO_IMAGE_MIN_CONFIDENCE ?? 0.75);
        const min = Number.isFinite(minRaw) ? Math.max(0, Math.min(1, minRaw)) : 0.75;
        let okByConfidence = min <= 0;
        if (!okByConfidence) {
          const c = p.discoveryCandidateId
            ? await prisma.discoveryCandidate.findUnique({ where: { id: p.discoveryCandidateId }, select: { confidenceScore: true } }).catch(() => null)
            : null;
          const score = c?.confidenceScore ?? null;
          okByConfidence = score != null && score >= min;
        }
        if (okByConfidence) {
          const context = deriveHeroContextFromPost({ body: p.body ?? '', summary: p.summary ?? '', shortDescription: p.shortDescription ?? null });
          const hero = await generateHeroImageDataUrl({ title: p.title, category: p.category ?? null, context });
          if (hero?.url) {
            patch.heroImageUrl = hero.url;
            patch.heroImageGeneratedAt = new Date();
            patch.heroImageSource = hero.source;
          } else {
            await prisma.systemAlert
              .create({
                data: {
                  type: 'SYSTEM',
                  severity: 'WARNING',
                  noisy: false,
                  message: `[hero-image] post=${p.id} generation failed (kept placeholder)`,
                },
              })
              .catch(() => null);
          }
        }
      }
      if (p.linkStatus === 'UNKNOWN' && !p.lastCheckedAt) {
        const r = await verifyLink(p.outboundUrl);
        patch.linkStatus = r.status;
        patch.lastCheckedAt = new Date();
      }
      if (Object.keys(patch).length) {
        await prisma.unaffiliatedPost.update({ where: { id: p.id }, data: patch });
      }
    } catch {
      // swallow; publishing must remain non-blocking
    }
  }

  // Post TTL: clamp to 30..60 days (default 45).
  const ttlRaw = Number(process.env.UNAFFILIATED_POST_TTL_DAYS ?? 45);
  const ttlDays = Number.isFinite(ttlRaw) ? Math.max(30, Math.min(60, Math.trunc(ttlRaw))) : 45;
  const postExpiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const candidates = await prisma.discoveryCandidate.findMany({
    where: {
      status: 'ACTIVE',
      isFresh: true,
      linkStatus: 'ACTIVE' as any,
      discoveredAt: { gte: new Date(getTodayUTC().getTime() - 24 * 60 * 60 * 1000) },
      unaffiliatedPost: { is: null },
    },
    orderBy: [{ confidenceScore: 'desc' }, { discoveredAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      retailer: true,
      category: true,
      description: true,
      outboundUrl: true,
      discoveredAt: true,
      expiresAt: true,
      confidenceScore: true,
      shortDescription: true,
      thumbnailUrl: true,
      thumbnailGeneratedAt: true,
      thumbnailSource: true,
      linkStatus: true,
      lastCheckedAt: true,
    },
  });
  if (candidates.length === 0) return { ok: true as const, skipped: true as const, reason: 'no_candidates', expired };

  const created: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const c of candidates) {
    try {
      const retailer = c.retailer as DiscoveryCandidateRetailer;
      const category = c.category ?? 'General';
      const shortDescription =
        c.shortDescription ??
        (c.description ? c.description.split(/[.!?]\s/)[0]?.trim().split(/\s+/).slice(0, 20).join(' ') : null) ??
        (await generateShortDescription({ title: c.title, category, retailer: String(retailer) }));

      // Best-effort thumbnail; prefer cached candidate thumbnail, otherwise generate now.
      const thumb: { url: string; source: 'ai' | 'fallback' } =
        c.thumbnailUrl != null
          ? { url: c.thumbnailUrl, source: c.thumbnailSource === 'ai' ? 'ai' : 'fallback' }
          : await generateThumbnailDataUrl({ title: c.title, category: c.category ?? null });

      // Best-effort link verification (must not block publishing). Only check if never checked.
      const link =
        c.lastCheckedAt == null && c.linkStatus === 'UNKNOWN'
          ? await verifyLink(c.outboundUrl)
          : { status: c.linkStatus as any, httpStatus: null as number | null };

      const system = `You write neutral, informational posts about trending products.
Rules:
- No sales language, no hype, no superlatives
- No pricing, no discounts, no deal claims
- No affiliate mentions, no commission mentions
- No calls-to-action beyond: \"View on retailer site\"
- Must not imply endorsement (do not recommend, do not call it a \"top pick\")
- Output MUST be valid JSON with keys: title, summary, body
- body MUST be markdown with EXACTLY these sections, using markdown headings:
  - \"## What it is\"
  - \"## Why it’s trending\"
  - \"## Common use cases\"
  - \"## Things to consider\"
- body MUST end with a single final line: \"View on retailer site: {outboundUrl}\"`;

      const user = `Write an unaffiliated informational post from this discovery candidate.

Candidate:
- retailer: ${retailer}
- title: ${c.title}
- category: ${category}
- discoveredAt: ${c.discoveredAt.toISOString()}
- outboundUrl: ${c.outboundUrl}
- notes: ${c.description ?? '(none)'}

Keep it short and SEO-safe.`;

      const raw = await generateShortText({ model: process.env.AI_FINAL_MODEL || 'gpt-4.1', system, user, temperature: 0.2, maxOutputTokens: 900 });
      const parsed = parseJsonObject<PostJson>(raw);

      const title = String(parsed.title ?? '').trim();
      const summary = String(parsed.summary ?? '').trim();
      const body = String(parsed.body ?? '').trim();

      if (!title || !summary || !body) throw new Error('invalid_ai_output');
      const full = `${title}\n${summary}\n${body}`;
      if (containsProhibitedLanguage(full)) throw new Error('prohibited_language_detected');
      if (impliesEndorsement(full)) throw new Error('endorsement_detected');
      if (!hasRequiredSectionsMarkdown(body)) throw new Error('missing_required_sections');
      if (!body.includes(c.outboundUrl)) throw new Error('missing_outbound_url_line');

      const slug = await uniqueSlug(title);

      // Atomic, idempotent conversion:
      // - create image intent (non-blocking)
      // - create post (unique by discoveryCandidateId)
      // - mark candidate consumed (removed from discovery feed)
      const post = await prisma.$transaction(async (tx) => {
        const intent = await tx.imageIntent
          .create({
            data: { entityType: 'DISCOVERY_CANDIDATE', entityId: c.id, imageType: 'CARD', status: 'PENDING' },
            select: { id: true },
          })
          .catch(() => null);

        const createdPost = await tx.unaffiliatedPost.create({
          data: {
            title,
            slug,
            retailer,
            category,
            summary,
            body,
            imageSetId: intent?.id ?? null,
            outboundUrl: c.outboundUrl,
            shortDescription: shortDescription ?? null,
            thumbnailUrl: thumb.url,
            thumbnailGeneratedAt: new Date(),
            thumbnailSource: thumb.source,
            linkStatus: link.status,
            lastCheckedAt: c.lastCheckedAt ?? new Date(),
            source: 'AI_ENRICHED',
            status: 'PUBLISHED',
            publishedAt: now,
            expiresAt: postExpiresAt,
            discoveryCandidateId: c.id,
          },
          select: { id: true },
        });

        await tx.discoveryCandidate.update({
          where: { id: c.id },
          data: { status: 'REMOVED', expiresAt: now },
        });

        return createdPost;
      });

      created.push(post.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown_error';
      skipped.push({ id: c.id, reason: msg });
      await prisma.systemAlert
        .create({
          data: { type: 'SYSTEM', severity: 'WARNING', noisy: false, message: `[unaffiliated-post] candidate=${c.id} skipped: ${msg}` },
        })
        .catch(() => null);
    }
  }

  return { ok: true as const, created, skipped, expired };
}

