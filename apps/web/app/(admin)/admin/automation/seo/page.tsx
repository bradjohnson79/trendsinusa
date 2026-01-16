import { prisma } from '@/src/server/prisma';
import { getServerEnv } from '@trendsinusa/shared';
import { sha256 } from '@/src/server/ai/hash';
import { generateShortText } from '@/src/server/ai/openai';
import { revalidatePath } from 'next/cache';

const PROMPT_VERSION = 'automation-seo-v1';

const SYSTEM = `You write neutral SEO metadata for ecommerce category pages.
Rules:
- No affiliate language, no pricing, no hype
- No emojis, no exclamation marks
- Output ONLY valid JSON with keys: title, description, confidenceScore (0..1).`;

async function generateSeo(formData: FormData) {
  'use server';
  const env = getServerEnv();
  const category = String(formData.get('category') ?? '').trim();
  if (!category) return;
  const model = env.AI_FINAL_MODEL;
  const input = JSON.stringify({ kind: 'category', category, promptVersion: PROMPT_VERSION });
  const inputHash = sha256(`seo:${model}:${input}`);
  const startedAt = new Date();

  try {
    const user = `Generate SEO metadata for a category page.
Category: ${category}
Audience: deal shoppers
Return JSON only.`;
    const raw = await generateShortText({ model, system: SYSTEM, user, maxOutputTokens: 180, temperature: 0.2 });
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const json = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
    const p = parsed as { title?: unknown; description?: unknown; confidenceScore?: unknown };
    const title = String(p.title ?? '').trim();
    const description = String(p.description ?? '').trim();
    const confidenceScore = Number(p.confidenceScore);
    if (!title || !description || !Number.isFinite(confidenceScore)) throw new Error('Invalid model output');

    const outputHash = sha256(JSON.stringify({ title, description, confidenceScore }));

    await prisma.aIActionLog.create({
      data: {
        role: 'SEO_META_GENERATOR',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model,
        modelUsed: model,
        outputPreview: `${title} | ${description}`.slice(0, 4000),
        confidenceScore,
        entityType: 'SEO',
        entityId: `category:${category.toLowerCase()}`,
        actionType: 'FINALIZE',
        inputHash,
        outputHash,
        manualOverride: true,
        metadata: { kind: 'category', category, title, description },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.aIActionLog.create({
      data: {
        role: 'SEO_META_GENERATOR',
        status: 'FAILURE',
        startedAt,
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model,
        modelUsed: model,
        error: message,
        entityType: 'SEO',
        entityId: `category:${category.toLowerCase()}`,
        actionType: 'FINALIZE',
        inputHash,
        manualOverride: true,
        metadata: { kind: 'category', category },
      },
    });
  }

  revalidatePath('/admin/automation/seo');
}

export default async function AutomationSeoPage() {
  const recent = await prisma.aIActionLog.findMany({
    where: { entityType: 'SEO' },
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: { id: true, startedAt: true, status: true, entityId: true, outputPreview: true, confidenceScore: true, manualOverride: true },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Generate category meta (review-required)</div>
        <p className="mt-1 text-sm text-slate-600">
          Outputs are stored as immutable logs only. They are not published automatically.
        </p>
        <form className="mt-3 flex flex-wrap gap-2" action={generateSeo}>
          <input name="category" placeholder="e.g. electronics" className="w-80 rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">Generate</button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Recent SEO runs</div>
        <div className="p-4 space-y-2">
          {recent.length === 0 ? (
            <div className="text-sm text-slate-600">No runs.</div>
          ) : (
            recent.map((r) => (
              <div key={r.id} className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-mono">{r.status}</span>
                  <span className="font-mono">{r.entityId}</span>
                  <span className="text-slate-500">{r.startedAt.toISOString()}</span>
                  <span className="text-slate-500">override:{r.manualOverride ? 'yes' : 'no'}</span>
                  <span className="text-slate-500">conf:{r.confidenceScore == null ? '—' : r.confidenceScore.toFixed(2)}</span>
                </div>
                <div className="mt-2">{r.outputPreview ?? ''}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

