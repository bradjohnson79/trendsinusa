import 'server-only';

import { getServerEnv } from '@trendsinusa/shared';
import { prisma } from '@/src/server/prisma';
import { sha256 } from '@/src/server/ai/hash';
import { perplexityResearch } from '@/src/server/ai/perplexity';
import { generateShortText } from '@/src/server/ai/openai';

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
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON from model');
  const o = parsed as { summary?: unknown; confidenceScore?: unknown };
  const summary = typeof o.summary === 'string' ? o.summary.trim() : '';
  const confidenceScore = typeof o.confidenceScore === 'number' ? o.confidenceScore : Number(o.confidenceScore);
  if (!summary) throw new Error('Missing summary');
  if (!Number.isFinite(confidenceScore) || confidenceScore < 0 || confidenceScore > 1) throw new Error('Invalid confidenceScore');
  return { summary, confidenceScore };
}

export async function generateProductCopy(params: { asin: string; manualOverride: boolean }) {
  const env = getServerEnv();
  const asin = params.asin.trim();
  if (!asin) throw new Error('Missing asin');

  const product = await prisma.product.findUnique({
    where: { asin },
    select: { id: true, asin: true, title: true, category: true, categoryOverride: true, aiDisabled: true, aiResearchDraft: true, aiFinalSummary: true },
  });
  if (!product) throw new Error('Product not found');
  if (product.aiDisabled) throw new Error('AI disabled for product');

  const researchModel = env.AI_RESEARCH_MODEL;
  const finalModel = env.AI_FINAL_MODEL;
  const minConfidence = env.AI_MIN_CONFIDENCE;

  const category = product.categoryOverride ?? product.category ?? 'unknown';

  // Input hash includes stable inputs only.
  const baseInput = JSON.stringify({ asin: product.asin, title: product.title, category, promptVersion: PROMPT_VERSION });
  const inputHashResearch = sha256(`research:${researchModel}:${baseInput}`);
  const inputHashFinal = sha256(`finalize:${finalModel}:${baseInput}`);

  const startedAtResearch = new Date();
  let research = '';
  try {
    const user = `Research this product and summarize neutral facts.
Product:
- ASIN: ${product.asin}
- Title: ${product.title}
- Category: ${category}

Output: bullet points, factual, no marketing, no pricing.`;

    research = await perplexityResearch({ model: researchModel, system: RESEARCH_SYSTEM, user, maxTokens: 700 });
    const outputHashResearch = sha256(research);

    await prisma.product.update({
      where: { asin },
      data: { aiResearchDraft: research },
    });

    await prisma.aIActionLog.create({
      data: {
        role: 'SEO_META_GENERATOR', // legacy role bucket; structured fields carry meaning
        status: 'SUCCESS',
        startedAt: startedAtResearch,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: researchModel,
        modelUsed: researchModel,
        outputPreview: research.slice(0, 4000),
        entityType: 'PRODUCT',
        entityId: product.id,
        actionType: 'RESEARCH',
        inputHash: inputHashResearch,
        outputHash: outputHashResearch,
        manualOverride: params.manualOverride,
        metadata: { asin: product.asin },
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
        entityId: product.id,
        actionType: 'RESEARCH',
        inputHash: inputHashResearch,
        manualOverride: params.manualOverride,
        metadata: { asin: product.asin },
      },
    });
    throw e;
  }

  const startedAtFinal = new Date();
  try {
    const user = `Turn the following research into a neutral product summary.

ASIN: ${product.asin}
Title: ${product.title}
Category: ${category}

Research notes:
${research || '(none)'}
`;

    const raw = await generateShortText({ model: finalModel, system: FINAL_SYSTEM, user, maxOutputTokens: 450, temperature: 0.2 });
    const { summary, confidenceScore } = parseJsonStrict(raw);

    const outputHashFinal = sha256(summary);

    // Abort on low confidence (no silent overwrites).
    if (confidenceScore < minConfidence) {
      await prisma.product.update({
        where: { asin },
        data: { aiConfidenceScore: confidenceScore },
      });
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
          entityId: product.id,
          actionType: 'FINALIZE',
          inputHash: inputHashFinal,
          outputHash: outputHashFinal,
          manualOverride: params.manualOverride,
          metadata: { asin: product.asin },
        },
      });
      return { ok: false as const, confidenceScore };
    }

    await prisma.product.update({
      where: { asin },
      data: {
        aiFinalSummary: summary,
        aiConfidenceScore: confidenceScore,
        aiLastGeneratedAt: new Date(),
      },
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
        entityId: product.id,
        actionType: 'FINALIZE',
        inputHash: inputHashFinal,
        outputHash: outputHashFinal,
        manualOverride: params.manualOverride,
        metadata: { asin: product.asin },
      },
    });

    return { ok: true as const, summary, confidenceScore };
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

