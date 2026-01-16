import { getServerEnv } from '@trendsinusa/shared';
import { prisma } from '@trendsinusa/db';
import { generateShortText } from './openai.js';
import { sha256 } from './hash.js';
import { perplexityResearch } from './perplexity.js';

const PROMPT_VERSION = 'automation-product-copy-v1';

const RESEARCH_SYSTEM = `You produce neutral research notes for a product.
Rules:
- No pricing, no deals, no affiliate language
- No hype, no emojis
- Use calm, factual tone
- If uncertain, say so
- Prefer bullet points`;

const FINAL_SYSTEM = `You write neutral product summaries for an ecommerce catalog.
Rules:
- No pricing, no discounts, no affiliate language
- No hype, no emojis, no exclamation marks
- 2 short paragraphs max
- Plain language, human tone
- Include only stable facts (features, use-cases, compatibility, sizing, materials)
Output MUST be valid JSON with keys: summary, confidenceScore (0..1).`;

function parseJsonStrict(s: string): { summary: string; confidenceScore: number } {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  const json = start !== -1 && end !== -1 ? s.slice(start, end + 1) : s;
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
  const p = parsed as { summary?: unknown; confidenceScore?: unknown };
  const summary = String(p.summary ?? '').trim();
  const confidenceScore = Number(p.confidenceScore);
  if (!summary) throw new Error('Missing summary');
  if (!Number.isFinite(confidenceScore) || confidenceScore < 0 || confidenceScore > 1) throw new Error('Invalid confidenceScore');
  return { summary, confidenceScore };
}

export async function runProductCopyForAsin(params: { asin: string; manualOverride: boolean }) {
  const env = getServerEnv();
  const asin = params.asin.trim();
  const p = await prisma.product.findUnique({
    where: { asin },
    select: { id: true, asin: true, title: true, category: true, categoryOverride: true, aiDisabled: true },
  });
  if (!p) throw new Error('Product not found');
  if (p.aiDisabled) return { skipped: true as const, reason: 'ai_disabled' };

  const category = p.categoryOverride ?? p.category ?? 'unknown';
  const researchModel = env.AI_RESEARCH_MODEL;
  const finalModel = env.AI_FINAL_MODEL;
  const minConfidence = env.AI_MIN_CONFIDENCE;

  const baseInput = JSON.stringify({ asin: p.asin, title: p.title, category, promptVersion: PROMPT_VERSION });
  const inputHashResearch = sha256(`research:${researchModel}:${baseInput}`);
  const inputHashFinal = sha256(`finalize:${finalModel}:${baseInput}`);

  // Research
  const startedAtResearch = new Date();
  const userResearch = `Research this product and summarize neutral facts.
Product:
- ASIN: ${p.asin}
- Title: ${p.title}
- Category: ${category}

Output: bullet points, factual, no marketing, no pricing.`;

  let research = '';
  try {
    research = await perplexityResearch({ model: researchModel, system: RESEARCH_SYSTEM, user: userResearch, maxTokens: 700 });
    const outputHash = sha256(research);
    await prisma.product.update({ where: { asin: p.asin }, data: { aiResearchDraft: research } });
    await prisma.aIActionLog.create({
      data: {
        role: 'SEO_META_GENERATOR',
        status: 'SUCCESS',
        startedAt: startedAtResearch,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: researchModel,
        modelUsed: researchModel,
        outputPreview: research.slice(0, 4000),
        entityType: 'PRODUCT',
        entityId: p.id,
        actionType: 'RESEARCH',
        inputHash: inputHashResearch,
        outputHash,
        manualOverride: params.manualOverride,
        metadata: { asin: p.asin },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.aIActionLog.create({
      data: {
        role: 'SEO_META_GENERATOR',
        status: 'FAILURE',
        startedAt: startedAtResearch,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: researchModel,
        modelUsed: researchModel,
        error: message,
        entityType: 'PRODUCT',
        entityId: p.id,
        actionType: 'RESEARCH',
        inputHash: inputHashResearch,
        manualOverride: params.manualOverride,
        metadata: { asin: p.asin },
      },
    });
    throw e;
  }

  // Finalize
  const startedAtFinal = new Date();
  try {
    const userFinal = `Turn the following research into a neutral product summary.

ASIN: ${p.asin}
Title: ${p.title}
Category: ${category}

Research notes:
${research || '(none)'}
`;
    const raw = await generateShortText({ model: finalModel, system: FINAL_SYSTEM, user: userFinal, maxOutputTokens: 450, temperature: 0.2 });
    const { summary, confidenceScore } = parseJsonStrict(raw);
    const outputHash = sha256(summary);

    if (confidenceScore < minConfidence) {
      await prisma.product.update({ where: { asin: p.asin }, data: { aiConfidenceScore: confidenceScore } });
      await prisma.aIActionLog.create({
        data: {
          role: 'SEO_META_GENERATOR',
          status: 'FAILURE',
          startedAt: startedAtFinal,
          finishedAt: new Date(),
          promptVersion: PROMPT_VERSION,
          model: finalModel,
          modelUsed: finalModel,
          error: `confidence_below_threshold:${confidenceScore.toFixed(2)}<${minConfidence.toFixed(2)}`,
          outputPreview: summary.slice(0, 4000),
          confidenceScore,
          entityType: 'PRODUCT',
          entityId: p.id,
          actionType: 'FINALIZE',
          inputHash: inputHashFinal,
          outputHash,
          manualOverride: params.manualOverride,
          metadata: { asin: p.asin },
        },
      });
      return { skipped: true as const, reason: 'low_confidence', confidenceScore };
    }

    await prisma.product.update({
      where: { asin: p.asin },
      data: { aiFinalSummary: summary, aiConfidenceScore: confidenceScore, aiLastGeneratedAt: new Date() },
    });
    await prisma.aIActionLog.create({
      data: {
        role: 'SEO_META_GENERATOR',
        status: 'SUCCESS',
        startedAt: startedAtFinal,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: finalModel,
        modelUsed: finalModel,
        outputPreview: summary.slice(0, 4000),
        confidenceScore,
        entityType: 'PRODUCT',
        entityId: p.id,
        actionType: 'FINALIZE',
        inputHash: inputHashFinal,
        outputHash,
        manualOverride: params.manualOverride,
        metadata: { asin: p.asin },
      },
    });

    return { skipped: false as const, confidenceScore };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.aIActionLog.create({
      data: {
        role: 'SEO_META_GENERATOR',
        status: 'FAILURE',
        startedAt: startedAtFinal,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: finalModel,
        modelUsed: finalModel,
        error: message,
        entityType: 'PRODUCT',
        entityId: p.id,
        actionType: 'FINALIZE',
        inputHash: inputHashFinal,
        manualOverride: params.manualOverride,
        metadata: { asin: p.asin },
      },
    });
    throw e;
  }
}

export async function runBatchRegenerateStaleProducts(params: { limit: number }) {
  const env = getServerEnv();
  const days = env.AI_AUTO_REGENERATE_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const products = await prisma.product.findMany({
    where: { aiDisabled: false, OR: [{ aiLastGeneratedAt: null }, { aiLastGeneratedAt: { lt: cutoff } }] },
    orderBy: [{ aiLastGeneratedAt: 'asc' }, { updatedAt: 'desc' }],
    take: params.limit,
    select: { asin: true },
  });

  const results: Array<{ asin: string; ok: boolean; skipped?: boolean; reason?: string }> = [];
  for (const p of products) {
    try {
      const r = await runProductCopyForAsin({ asin: p.asin, manualOverride: false });
      const reason = (r as { reason?: string }).reason;
      results.push({ asin: p.asin, ok: true, skipped: r.skipped, ...(reason ? { reason } : {}) });
    } catch (e) {
      results.push({ asin: p.asin, ok: false, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

