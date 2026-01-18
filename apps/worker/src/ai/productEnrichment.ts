import { getServerEnv } from '@trendsinusa/shared';
import { prisma } from '@trendsinusa/db';
import { sha256 } from './hash.js';
import { perplexityResearch } from './perplexity.js';
import { generateShortText } from './openai.js';
import { maybeAdvanceToReadyAndPublish, transitionPostingItem } from '../posting/lifecycle.js';

const PROMPT_VERSION = 'automation-product-enrichment-v1';

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

type ResearchJson = {
  summary: string;
  sources: Array<{ url: string; title?: string }>;
};

type FinalJson = {
  summary: string;
  highlights: string[];
  confidenceScore: number;
  sourcesUsed: string[];
};

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

function validateResearch(r: ResearchJson) {
  const summary = normalizeWhitespace(String(r.summary ?? ''));
  if (!summary) throw new Error('Research JSON missing summary');
  const sources = Array.isArray(r.sources) ? r.sources : [];
  const normalizedSources = sources
    .map((x) => {
      const url = String((x as any)?.url ?? '').trim();
      const titleRaw = (x as any)?.title;
      const title = titleRaw != null ? String(titleRaw).trim() : '';
      return title ? ({ url, title } as { url: string; title: string }) : ({ url } as { url: string });
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

export async function runProductEnrichmentForAsin(params: { asin: string; manualOverride: boolean; force?: boolean }) {
  const env = getServerEnv();
  const asin = params.asin.trim();
  if (!asin) throw new Error('Missing asin');

  const product = await prisma.product.findUnique({
    where: { asin },
    select: { id: true, asin: true, title: true, category: true, categoryOverride: true, aiDisabled: true },
  });
  if (!product) throw new Error('Product not found');
  if (product.aiDisabled) return { skipped: true as const, reason: 'ai_disabled' };

  const category = product.categoryOverride ?? product.category ?? 'unknown';
  const researchModel = env.AI_RESEARCH_MODEL;
  const finalModel = env.AI_FINAL_MODEL;
  const minConfidence = env.AI_MIN_CONFIDENCE;

  const baseInput = JSON.stringify({ asin: product.asin, title: product.title, category, promptVersion: PROMPT_VERSION });
  const inputHashResearch = sha256(`research:${researchModel}:${baseInput}`);
  const inputHashFinal = sha256(`finalize:${finalModel}:${baseInput}`);

  if (!params.force) {
    const existing = await prisma.productAIEnrichment.findUnique({
      where: { productId_inputHashFinal: { productId: product.id, inputHashFinal } },
      select: { id: true },
    });
    if (existing) return { skipped: true as const, reason: 'cached' };
  }

  // 1) Research (Perplexity) — stored separately
  const startedAtResearch = new Date();
  let researchText = '';
  let researchSources: ResearchJson['sources'] = [];

  try {
    const user = `Research this product and produce a factual, neutral summary with sources.
Product:
- ASIN: ${product.asin}
- Title: ${product.title}
- Category: ${category}

Return JSON exactly (no markdown).`;

    researchText = await perplexityResearch({ model: researchModel, system: RESEARCH_SYSTEM, user, maxTokens: 900 });
    const parsed = validateResearch(parseJsonObject<ResearchJson>(researchText));
    researchText = parsed.summary;
    researchSources = parsed.sources;

    await prisma.aIActionLog.create({
      data: {
        role: 'PRODUCT_ENRICHMENT',
        status: 'SUCCESS',
        startedAt: startedAtResearch,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: researchModel,
        modelUsed: researchModel,
        outputPreview: researchText.slice(0, 4000),
        entityType: 'PRODUCT',
        entityId: product.id,
        actionType: 'RESEARCH',
        inputHash: inputHashResearch,
        outputHash: sha256(researchText),
        manualOverride: params.manualOverride,
        metadata: { asin: product.asin, sourcesCount: researchSources.length },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.aIActionLog.create({
      data: {
        role: 'PRODUCT_ENRICHMENT',
        status: 'FAILURE',
        startedAt: startedAtResearch,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: researchModel,
        modelUsed: researchModel,
        error: message,
        entityType: 'PRODUCT',
        entityId: product.id,
        actionType: 'RESEARCH',
        inputHash: inputHashResearch,
        manualOverride: params.manualOverride,
        metadata: { asin: product.asin },
      },
    });
    throw e;
  }

  // 2) Finalize (GPT‑4.1) — polish + highlights, no price claims, no unsourced superlatives
  const startedAtFinal = new Date();
  try {
    const sourcesBlock = researchSources.length
      ? researchSources.map((s) => `- ${s.url}${s.title ? ` (${s.title})` : ''}`).join('\n')
      : '(none)';

    const user = `Use the research to produce enriched catalog copy.

Product:
- ASIN: ${product.asin}
- Title: ${product.title}
- Category: ${category}

Research summary:
${researchText}

Sources:
${sourcesBlock}

Return JSON exactly (no markdown).`;

    const raw = await generateShortText({ model: finalModel, system: FINAL_SYSTEM, user, maxOutputTokens: 650, temperature: 0.2 });
    const parsed = validateFinal(parseJsonObject<FinalJson>(raw));

    // Confidence gate: never silently “publish” low-confidence output.
    if (parsed.confidenceScore < minConfidence) {
      await prisma.aIActionLog.create({
        data: {
          role: 'PRODUCT_ENRICHMENT',
          status: 'FAILURE',
          startedAt: startedAtFinal,
          finishedAt: new Date(),
          promptVersion: PROMPT_VERSION,
          model: finalModel,
          modelUsed: finalModel,
          error: `confidence_below_threshold:${parsed.confidenceScore.toFixed(2)}<${minConfidence.toFixed(2)}`,
          outputPreview: parsed.summary.slice(0, 4000),
          confidenceScore: parsed.confidenceScore,
          entityType: 'PRODUCT',
          entityId: product.id,
          actionType: 'FINALIZE',
          inputHash: inputHashFinal,
          outputHash: sha256(parsed.summary),
          manualOverride: params.manualOverride,
          metadata: { asin: product.asin },
        },
      });
      return { skipped: true as const, reason: 'low_confidence', confidenceScore: parsed.confidenceScore };
    }

    // Persist output separately. Never overwrite source Product data fields.
    await prisma.productAIEnrichment.upsert({
      where: { productId_inputHashFinal: { productId: product.id, inputHashFinal } },
      create: {
        productId: product.id,
        promptVersion: PROMPT_VERSION,
        researchModel,
        finalModel,
        inputHashResearch,
        inputHashFinal,
        outputHashResearch: sha256(researchText),
        outputHashFinal: sha256(parsed.summary),
        researchText,
        researchSources: researchSources as any,
        finalSummary: parsed.summary,
        finalHighlights: parsed.highlights,
        finalSources: parsed.sourcesUsed as any,
        confidenceScore: parsed.confidenceScore,
      },
      update: {
        // In practice this should rarely hit due to unique key, but keeps behavior deterministic.
        outputHashResearch: sha256(researchText),
        outputHashFinal: sha256(parsed.summary),
        researchText,
        researchSources: researchSources as any,
        finalSummary: parsed.summary,
        finalHighlights: parsed.highlights,
        finalSources: parsed.sourcesUsed as any,
        confidenceScore: parsed.confidenceScore,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorType: 'AI',
        entityType: 'PRODUCT',
        entityId: product.id,
        action: 'AI_REWRITE',
        summary: `AI enrichment updated for ${product.asin}`,
        metadata: {
          asin: product.asin,
          promptVersion: PROMPT_VERSION,
          researchModel,
          finalModel,
          confidenceScore: parsed.confidenceScore,
        } as any,
      },
    });

    await prisma.aIActionLog.create({
      data: {
        role: 'PRODUCT_ENRICHMENT',
        status: 'SUCCESS',
        startedAt: startedAtFinal,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: finalModel,
        modelUsed: finalModel,
        outputPreview: parsed.summary.slice(0, 4000),
        confidenceScore: parsed.confidenceScore,
        entityType: 'PRODUCT',
        entityId: product.id,
        actionType: 'FINALIZE',
        inputHash: inputHashFinal,
        outputHash: sha256(parsed.summary),
        manualOverride: params.manualOverride,
        metadata: { asin: product.asin, highlights: parsed.highlights },
      },
    });

    // Posting lifecycle: INGESTED -> ENRICHED (kill switch respected inside transition helper).
    const posting = await prisma.postingItem.findUnique({ where: { productId: product.id }, select: { id: true, state: true } }).catch(() => null);
    if (posting && posting.state === 'INGESTED') {
      await transitionPostingItem({ id: posting.id, to: 'ENRICHED' }).catch(() => null);
      await maybeAdvanceToReadyAndPublish({ postingItemId: posting.id }).catch(() => null);
    }

    return { skipped: false as const, confidenceScore: parsed.confidenceScore };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.aIActionLog.create({
      data: {
        role: 'PRODUCT_ENRICHMENT',
        status: 'FAILURE',
        startedAt: startedAtFinal,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: finalModel,
        modelUsed: finalModel,
        error: message,
        entityType: 'PRODUCT',
        entityId: product.id,
        actionType: 'FINALIZE',
        inputHash: inputHashFinal,
        manualOverride: params.manualOverride,
        metadata: { asin: product.asin },
      },
    });
    throw e;
  }
}

export async function runProductEnrichmentBatch(params: { limit: number }) {
  const products = await prisma.product.findMany({
    where: { aiDisabled: false },
    orderBy: [{ updatedAt: 'desc' }],
    take: params.limit,
    select: { asin: true },
  });

  const results: Array<{ asin: string; ok: boolean; skipped?: boolean; reason?: string }> = [];
  for (const p of products) {
    try {
      const r = await runProductEnrichmentForAsin({ asin: p.asin, manualOverride: false });
      const reason = (r as any)?.reason;
      results.push({ asin: p.asin, ok: true, skipped: r.skipped, ...(reason ? { reason } : {}) });
    } catch (e) {
      results.push({ asin: p.asin, ok: false, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return results;
}

