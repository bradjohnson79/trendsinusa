import 'server-only';

import { getServerEnv } from '@trendsinusa/shared';
import { prisma } from '@/src/server/prisma';
import { sha256 } from '@/src/server/ai/hash';
import { generateShortText } from '@/src/server/ai/openai';

const PROMPT_VERSION = 'automation-deal-intel-v1';

const SYSTEM = `You evaluate ecommerce deals for urgency and quality.
You must output ONLY valid JSON with keys:
urgencyTier ("ONE_HOUR"|"SIX_HOUR"|"TWENTY_FOUR_HOUR"),
priorityScore (number 0..1),
aiFeatured (boolean),
aiSuppressed (boolean),
confidenceScore (number 0..1),
notes (string, short).
Rules:
- Never reference affiliate language
- No hype, no emojis
- Prefer suppression if pricing looks suspicious or metadata is incomplete
- Use click velocity as a signal when available`;

function parseJsonStrict(s: string): {
  urgencyTier: 'ONE_HOUR' | 'SIX_HOUR' | 'TWENTY_FOUR_HOUR';
  priorityScore: number;
  aiFeatured: boolean;
  aiSuppressed: boolean;
  confidenceScore: number;
  notes: string;
} {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  const json = start !== -1 && end !== -1 ? s.slice(start, end + 1) : s;
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
  const p = parsed as {
    urgencyTier?: unknown;
    priorityScore?: unknown;
    aiFeatured?: unknown;
    aiSuppressed?: unknown;
    confidenceScore?: unknown;
    notes?: unknown;
  };
  const urgencyTier = String(p.urgencyTier ?? '');
  if (!['ONE_HOUR', 'SIX_HOUR', 'TWENTY_FOUR_HOUR'].includes(urgencyTier)) throw new Error('Invalid urgencyTier');
  const priorityScore = Number(p.priorityScore);
  const confidenceScore = Number(p.confidenceScore);
  const aiFeatured = Boolean(p.aiFeatured);
  const aiSuppressed = Boolean(p.aiSuppressed);
  const notes = String(p.notes ?? '').trim();
  if (!Number.isFinite(priorityScore) || priorityScore < 0 || priorityScore > 1) throw new Error('Invalid priorityScore');
  if (!Number.isFinite(confidenceScore) || confidenceScore < 0 || confidenceScore > 1) throw new Error('Invalid confidenceScore');
  return { urgencyTier: urgencyTier as 'ONE_HOUR' | 'SIX_HOUR' | 'TWENTY_FOUR_HOUR', priorityScore, aiFeatured, aiSuppressed, confidenceScore, notes: notes.slice(0, 500) };
}

export async function evaluateDealIntelligence(params: { dealId: string; manualOverride: boolean }) {
  const env = getServerEnv();
  const dealId = params.dealId.trim();
  if (!dealId) throw new Error('Missing dealId');

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      status: true,
      suppressed: true,
      discountPercent: true,
      currentPriceCents: true,
      oldPriceCents: true,
      currency: true,
      expiresAt: true,
      productId: true,
      product: { select: { asin: true, title: true, category: true, categoryOverride: true } },
    },
  });
  if (!deal) throw new Error('Deal not found');

  const now = new Date();
  const hoursRemaining = Math.max(0, (deal.expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000));

  // Click velocity (proxy): partner + organic affiliate clicks for this deal in windows.
  const since1h = new Date(Date.now() - 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [clicks1h, clicks24h] = await Promise.all([
    prisma.clickEvent.count({ where: { dealId: deal.id, occurredAt: { gte: since1h }, referrer: { contains: 'event=affiliate_click' } } }),
    prisma.clickEvent.count({ where: { dealId: deal.id, occurredAt: { gte: since24h }, referrer: { contains: 'event=affiliate_click' } } }),
  ]);

  const category = deal.product.categoryOverride ?? deal.product.category ?? 'unknown';
  const categoryLiveDeals = await prisma.deal.count({
    where: {
      suppressed: false,
      status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] },
      expiresAt: { gt: now },
      product: { OR: [{ categoryOverride: category }, { category: category }] },
    },
  });

  const finalModel = env.AI_FINAL_MODEL;
  const input = JSON.stringify({
    dealId: deal.id,
    asin: deal.product.asin,
    title: deal.product.title,
    category,
    discountPercent: deal.discountPercent,
    currentPriceCents: deal.currentPriceCents,
    oldPriceCents: deal.oldPriceCents,
    currency: deal.currency,
    hoursRemaining,
    clicks1h,
    clicks24h,
    categoryLiveDeals,
    promptVersion: PROMPT_VERSION,
  });
  const inputHash = sha256(`deal-intel:${finalModel}:${input}`);

  const startedAt = new Date();
  try {
    const user = `Evaluate this deal:
Deal:
- id: ${deal.id}
- status: ${deal.status}
- manualSuppressed: ${deal.suppressed}
- category: ${category}
- discountPercent: ${deal.discountPercent ?? 'n/a'}
- currentPriceCents: ${deal.currentPriceCents}
- oldPriceCents: ${deal.oldPriceCents ?? 'n/a'}
- hoursRemaining: ${hoursRemaining.toFixed(2)}

Signals:
- clicksLast1h: ${clicks1h}
- clicksLast24h: ${clicks24h}
- categoryLiveDeals: ${categoryLiveDeals}

Return JSON only.`;

    const raw = await generateShortText({ model: finalModel, system: SYSTEM, user, maxOutputTokens: 220, temperature: 0.2 });
    const out = parseJsonStrict(raw);
    const outputHash = sha256(JSON.stringify(out));

    // Admin overrides always win: never flip manual suppressed. We still record aiSuppressed for inspection.
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        dealPriorityScore: out.priorityScore,
        urgencyTier: out.urgencyTier,
        aiSuppressed: out.aiSuppressed,
        aiFeatured: out.aiFeatured,
        aiEvaluatedAt: new Date(),
      },
    });

    await prisma.aIActionLog.create({
      data: {
        role: 'SEO_META_GENERATOR',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: finalModel,
        modelUsed: finalModel,
        outputPreview: out.notes,
        confidenceScore: out.confidenceScore,
        entityType: 'DEAL',
        entityId: deal.id,
        actionType: 'EVALUATE',
        inputHash,
        outputHash,
        manualOverride: params.manualOverride,
        metadata: { dealId: deal.id, asin: deal.product.asin, notes: out.notes, signals: { clicks1h, clicks24h, categoryLiveDeals } },
      },
    });

    return out;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.aIActionLog.create({
      data: {
        role: 'SEO_META_GENERATOR',
        status: 'FAILURE',
        startedAt,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: finalModel,
        modelUsed: finalModel,
        error: message,
        entityType: 'DEAL',
        entityId: deal.id,
        actionType: 'EVALUATE',
        inputHash,
        manualOverride: params.manualOverride,
        metadata: { dealId: deal.id, asin: deal.product.asin },
      },
    });
    throw e;
  }
}

