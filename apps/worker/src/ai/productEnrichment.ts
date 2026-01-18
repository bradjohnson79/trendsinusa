import { getServerEnv } from '@trendsinusa/shared';
import { prisma } from '@trendsinusa/db';

import { sha256 } from './hash.js';
import { perplexityResearch } from './perplexity.js';
import { generateShortText } from './openai.js';

const PROMPT_VERSION = 'automation-product-enrichment-v2-nano-only';

const RESEARCH_SYSTEM = `You produce factual, neutral product research.
Rules:
- Neutral tone.
- No pricing or deal claims.
- If uncertain, say so.
Output MUST be short plain text (no markdown).`;

const FINAL_SYSTEM = `Return JSON ONLY with keys:
- description: string (1-3 neutral sentences)
- whyTrending: string (1 neutral sentence)
- category: string (single short label)
- confidenceScore: number (0..1)
Rules:
- No pricing, no deals, no sales language.
- No affiliate mentions.
- Keep description <= 3 sentences.
- Keep whyTrending <= 1 sentence.
- Output must be valid JSON (no markdown, no commentary).`;

type FinalJson = {
  description: string;
  whyTrending: string;
  category: string;
  confidenceScore: number;
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

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function validateFinal(f: FinalJson) {
  const description = normalizeWhitespace(String((f as any).description ?? ''));
  const whyTrending = normalizeWhitespace(String((f as any).whyTrending ?? ''));
  const category = normalizeWhitespace(String((f as any).category ?? ''));
  const confidenceScore = clamp01(Number((f as any).confidenceScore));

  if (!description) throw new Error('missing_description');
  if (!whyTrending) throw new Error('missing_why_trending');
  if (!category) throw new Error('missing_category');
  if (!Number.isFinite(confidenceScore)) throw new Error('invalid_confidence');

  const t = `${description} ${whyTrending}`.toLowerCase();
  if (t.includes('$') || t.includes('usd') || t.includes('price') || t.includes('deal') || t.includes('discount')) throw new Error('price_or_deal_claim');
  if (t.includes('affiliate') || t.includes('commission')) throw new Error('affiliate_claim');

  return { description, whyTrending, category, confidenceScore };
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

  const categoryHint = product.categoryOverride ?? product.category ?? 'unknown';

  const researchModel = env.AI_RESEARCH_MODEL;
  const baseInput = JSON.stringify({ asin: product.asin, title: product.title, categoryHint, promptVersion: PROMPT_VERSION });
  const inputHashResearch = sha256(`research:${researchModel}:${baseInput}`);
  const inputHashFinal = sha256(`finalize:nano:${baseInput}`);

  if (!params.force) {
    const existing = await prisma.productAIEnrichment
      .findUnique({ where: { productId_inputHashFinal: { productId: product.id, inputHashFinal } }, select: { id: true } })
      .catch(() => null);
    if (existing) return { skipped: true as const, reason: 'cached' };
  }

  const startedAt = new Date();
  let researchText = '';

  // 1) Research (Perplexity): short, factual text.
  try {
    const user = `Research this product in one short paragraph.
Product:
- ASIN: ${product.asin}
- Title: ${product.title}
- Category hint: ${categoryHint}`;

    researchText = await perplexityResearch({ model: researchModel, system: RESEARCH_SYSTEM, user, maxTokens: 700 });
    researchText = normalizeWhitespace(researchText).slice(0, 3000);
  } catch {
    researchText = '';
  }

  // 2) Finalize (gpt-4.1-nano): ONLY allowed short fields.
  const user = `Produce enrichment JSON for this product.

Product:
- ASIN: ${product.asin}
- Title: ${product.title}
- Category hint: ${categoryHint}

Research:
${researchText || '(none)'}
`;

  const raw = await generateShortText({ model: env.AI_FINAL_MODEL, system: FINAL_SYSTEM, user, maxOutputTokens: 180, temperature: 0 });
  const parsed = validateFinal(parseJsonObject<FinalJson>(raw));

  // Persist into existing enrichment table fields, using minimal data.
  await prisma.productAIEnrichment.upsert({
    where: { productId_inputHashFinal: { productId: product.id, inputHashFinal } },
    create: {
      productId: product.id,
      promptVersion: PROMPT_VERSION,
      researchModel,
      finalModel: 'gpt-4.1-nano',
      inputHashResearch,
      inputHashFinal,
      outputHashResearch: sha256(researchText),
      outputHashFinal: sha256(parsed.description),
      researchText,
      researchSources: [] as any,
      finalSummary: parsed.description,
      finalHighlights: [parsed.whyTrending] as any,
      finalSources: [] as any,
      confidenceScore: parsed.confidenceScore,
    },
    update: {
      outputHashResearch: sha256(researchText),
      outputHashFinal: sha256(parsed.description),
      researchText,
      researchSources: [] as any,
      finalSummary: parsed.description,
      finalHighlights: [parsed.whyTrending] as any,
      finalSources: [] as any,
      confidenceScore: parsed.confidenceScore,
    },
  });

  await prisma.aIActionLog
    .create({
      data: {
        role: 'PRODUCT_ENRICHMENT',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: 'gpt-4.1-nano',
        modelUsed: 'gpt-4.1-nano',
        outputPreview: `${parsed.description} ${parsed.whyTrending}`.slice(0, 4000),
        confidenceScore: parsed.confidenceScore,
        entityType: 'PRODUCT',
        entityId: product.id,
        actionType: 'FINALIZE',
        inputHash: inputHashFinal,
        outputHash: sha256(parsed.description),
        manualOverride: params.manualOverride,
        metadata: { asin: product.asin, category: parsed.category },
      },
    })
    .catch(() => null);

  return { skipped: false as const, ok: true as const, confidenceScore: parsed.confidenceScore, category: parsed.category };
}
