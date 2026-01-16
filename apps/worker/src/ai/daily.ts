import { prisma } from '@trendsinusa/db';

import { generateShortText } from './openai.js';

const PROMPT_VERSION = 'ai-v1';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function enforceMaxWords(s: string, maxWords: number): string {
  const words = normalizeLine(s).split(' ').filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

const SYSTEM_TONE = `You write professional ecommerce copy.
Rules:
- Benefit-forward
- No hype spam
- No emojis
- No exclamation marks
- Keep it concise`;

export async function runDailyHeroHeadlineWriter() {
  const model = process.env.AI_COPY_MODEL ?? 'gpt-4.1';
  const today = startOfToday();

  const deals = await prisma.deal.findMany({
    where: { status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] }, suppressed: false },
    orderBy: { expiresAt: 'asc' },
    take: 10,
    include: { product: true },
  });

  const context = deals.map((d) => `- ${d.product.title}`).join('\n');

  const user = `Write ONE homepage hero headline for trendsinusa.com.
Constraints:
- 6 to 12 words
- Professional ecommerce tone
- No emojis, no hype, no exclamation marks
- Should feel timely and deal-focused

Context (top deals):
${context || '(no deals available)'}
`;

  const startedAt = new Date();
  const log = await prisma.aIActionLog.create({
    data: {
      role: 'HERO_HEADLINE_WRITER',
      status: 'FAILURE',
      startedAt,
      promptVersion: PROMPT_VERSION,
      model,
      metadata: { runType: 'daily', dealCount: deals.length },
    },
  });

  try {
    let headline = await generateShortText({ model, system: SYSTEM_TONE, user, maxOutputTokens: 40 });
    headline = enforceMaxWords(headline, 12);
    headline = headline.replace(/[!]+/g, '').trim();

    await prisma.heroRotation.upsert({
      where: { forDate: today },
      create: {
        forDate: today,
        headline,
        source: 'AI',
        promptVersion: PROMPT_VERSION,
        model,
      },
      update: {
        headline,
        source: 'AI',
        promptVersion: PROMPT_VERSION,
        model,
      },
    });

    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        outputPreview: headline,
      },
    });

    return { headline };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: { status: 'FAILURE', finishedAt: new Date(), error: message },
    });
    throw e;
  }
}

export async function runDailyBannerTextWriterAndImage() {
  const textModel = process.env.AI_COPY_MODEL ?? 'gpt-4.1';
  // Image generation is handled by the dedicated Visual Assets pipeline (Phase 11.3A).
  // Keep this daily job text-only to enforce locked prompt templates + no-product/no-logo/no-text image rules.

  const banners = await prisma.banner.findMany({
    where: { enabled: true },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });

  const startedAt = new Date();
  const log = await prisma.aIActionLog.create({
    data: {
      role: 'BANNER_TEXT_WRITER',
      status: 'FAILURE',
      startedAt,
      promptVersion: PROMPT_VERSION,
      model: textModel,
      metadata: { runType: 'daily', bannerIds: banners.map((b) => b.id) },
    },
  });

  try {
    const results: Array<{ bannerId: string; text: string; imageUrl?: string }> = [];

    for (const b of banners) {
      const user = `Write ONE short category banner tagline (3-4 words max).
Constraints:
- No emojis, no hype, no exclamation marks
- Benefit-forward
- Professional ecommerce tone
- 3 to 4 words max

Category: ${b.category ?? 'General'}
Existing title: ${b.title ?? '(none)'}
`;

      let text = await generateShortText({ model: textModel, system: SYSTEM_TONE, user, maxOutputTokens: 24 });
      text = enforceMaxWords(text, 4);
      text = text.replace(/[!]+/g, '').trim();

      await prisma.banner.update({
        where: { id: b.id },
        data: {
          text,
          source: 'AI',
        },
      });

      results.push({ bannerId: b.id, text });
    }

    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        outputPreview: results.map((r) => `${r.bannerId}: ${r.text}`).join(' | ').slice(0, 4000),
        metadata: { runType: 'daily', bannerIds: banners.map((b) => b.id), results },
      },
    });

    return results;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: { status: 'FAILURE', finishedAt: new Date(), error: message },
    });
    throw e;
  }
}

export async function runDailyDealMicroCopyWriter() {
  const model = process.env.AI_COPY_MODEL ?? 'gpt-4.1';
  const now = new Date();

  const deals = await prisma.deal.findMany({
    where: { status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] }, suppressed: false, expiresAt: { gt: now } },
    orderBy: { expiresAt: 'asc' },
    take: 20,
    include: { product: true },
  });

  const startedAt = new Date();
  const log = await prisma.aIActionLog.create({
    data: {
      role: 'DEAL_MICRO_COPY_WRITER',
      status: 'FAILURE',
      startedAt,
      promptVersion: PROMPT_VERSION,
      model,
      metadata: { runType: 'daily', dealIds: deals.map((d) => d.id) },
    },
  });

  try {
    const copies: Array<{ dealId: string; asin: string; copy: string }> = [];

    for (const d of deals) {
      const user = `Write ONE micro-copy line for a deal (6-8 words max).
Constraints:
- No emojis, no hype, no exclamation marks
- Benefit-forward, professional ecommerce tone
- 6 to 8 words max

Product: ${d.product.title}
Deal: currentPriceCents=${d.currentPriceCents}, oldPriceCents=${d.oldPriceCents ?? 'n/a'}, expiresAt=${d.expiresAt.toISOString()}
`;
      let copy = await generateShortText({ model, system: SYSTEM_TONE, user, maxOutputTokens: 32 });
      copy = enforceMaxWords(copy, 8);
      copy = copy.replace(/[!]+/g, '').trim();
      copies.push({ dealId: d.id, asin: d.product.asin, copy });
    }

    // IMPORTANT: Deal has no copy field yet (schema locked). We persist microcopy in AIActionLog metadata.
    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        outputPreview: copies.map((c) => c.copy).slice(0, 5).join(' | ').slice(0, 4000),
        metadata: { runType: 'daily', copies },
      },
    });

    return copies;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: { status: 'FAILURE', finishedAt: new Date(), error: message },
    });
    throw e;
  }
}

