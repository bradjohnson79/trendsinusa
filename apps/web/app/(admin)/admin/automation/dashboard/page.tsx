import { prisma } from '@/src/server/prisma';
import { cookies } from 'next/headers';
import { getServerEnv } from '@trendsinusa/shared';
import { getAutomationConfig } from '@/src/server/admin/automationConfig';
import { queueCategoryRegenerate, queueHeroRegenerate, saveImageGenEnabled } from './actions';

export default async function AutomationDashboardPage() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const env = getServerEnv();
  const store = await cookies();
  const selectedSiteKey = store.get('tui_admin_site')?.value ?? env.SITE_KEY;

  const [runs24h, avgConfidence, productsWithAI, dealsFeatured, dealsSuppressed, errors, cfg] = await Promise.all([
    prisma.aIActionLog.count({ where: { startedAt: { gte: since24h } } }),
    prisma.aIActionLog.aggregate({ where: { startedAt: { gte: since24h }, confidenceScore: { not: null } }, _avg: { confidenceScore: true } }),
    prisma.product.count({ where: { aiLastGeneratedAt: { not: null } } }),
    prisma.deal.count({ where: { aiFeatured: true } }),
    prisma.deal.count({ where: { aiSuppressed: true } }),
    prisma.systemAlert.findMany({ where: { noisy: false, resolvedAt: null }, orderBy: { createdAt: 'desc' }, take: 10 }),
    getAutomationConfig(selectedSiteKey),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">AI runs (24h)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{runs24h}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Avg confidence (24h)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {avgConfidence._avg.confidenceScore == null ? '—' : avgConfidence._avg.confidenceScore.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Products generated</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{productsWithAI}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Deals AI-featured</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{dealsFeatured}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Deals AI-suppressed</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{dealsSuppressed}</div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Visual Assets (DALL·E + Sharp)</div>
        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-600">
            Decorative backgrounds only. No products, logos, brand names, or text. Output is pre-sized and stored in asset storage; frontend consumes URLs only.
          </div>

          <form action={saveImageGenEnabled} className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="imageGenEnabled" defaultChecked={cfg.imageGenEnabled} />
              Enable image generation (site: <span className="font-mono text-xs">{cfg.siteKey}</span>)
            </label>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Save
            </button>
          </form>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-medium text-slate-900">Hero background</div>
              <div className="mt-1 text-xs text-slate-600">
                Requested: {cfg.heroRegenerateAt ? cfg.heroRegenerateAt.toISOString() : '—'} (processed by worker cron)
              </div>
              <form action={queueHeroRegenerate} className="mt-2">
                <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">
                  Regenerate hero image
                </button>
              </form>
            </div>

            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-medium text-slate-900">Category banners</div>
              <div className="mt-1 text-xs text-slate-600">
                Requested: {cfg.categoryRegenerateAt ? cfg.categoryRegenerateAt.toISOString() : '—'} (processed by worker cron)
              </div>
              <form action={queueCategoryRegenerate} className="mt-2">
                <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">
                  Regenerate category images
                </button>
              </form>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            To run immediately in dev: <code className="rounded bg-slate-100 px-1">pnpm --filter @trendsinusa/worker run:ai:hero-image</code> and{' '}
            <code className="rounded bg-slate-100 px-1">pnpm --filter @trendsinusa/worker run:ai:category-images</code>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Errors (non-noisy)</div>
        <div className="p-4">
          {errors.length === 0 ? (
            <div className="text-sm text-slate-600">No active errors.</div>
          ) : (
            <ul className="space-y-2">
              {errors.map((a) => (
                <li key={a.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  <div className="font-medium">{a.type}</div>
                  <div className="text-slate-600">{a.message}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

