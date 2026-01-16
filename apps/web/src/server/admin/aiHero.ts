import 'server-only';

import { prisma } from '@/src/server/prisma';

import { generateShortText } from '@/src/server/ai/openai';

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

export async function regenerateHeroHeadline() {
  const model = process.env.AI_COPY_MODEL ?? 'gpt-4.1';
  const today = startOfToday();

  const deals = await prisma.deal.findMany({
    where: {
      status: { in: ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] },
      suppressed: false,
      expiresAt: { gt: new Date() },
    },
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
      metadata: { runType: 'admin_force', dealCount: deals.length },
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
      data: { status: 'SUCCESS', finishedAt: new Date(), outputPreview: headline },
    });

    return headline;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: { status: 'FAILURE', finishedAt: new Date(), error: message },
    });
    throw e;
  }
}

