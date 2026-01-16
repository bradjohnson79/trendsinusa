import { getSeoHealth } from '@/src/server/admin/seo';

export default async function AdminSeoPromotionPage() {
  const health = await getSeoHealth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">SEO &amp; Promotion</h1>
        <p className="mt-1 text-sm text-slate-600">
          SEO health + AI-assisted improvements. Designed for compounding traffic, not busywork.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          SEO overview (read-only)
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Indexable pages (approx)</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{health.indexablePagesApprox}</div>
              <div className="mt-1 text-xs text-slate-500">
                Approx = public routes + active product pages. True indexed count requires Search Console.
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Active product pages</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{health.activeProductCount}</div>
              <div className="mt-1 text-xs text-slate-500">Products with ≥ 1 live deal</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Active deals</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{health.activeDealCount}</div>
              <div className="mt-1 text-xs text-slate-500">Excludes suppressed + expired</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Products total</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{health.totalProductCount}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Pages “missing meta” (proxy)</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{health.productsWithoutActiveDeal}</div>
              <div className="mt-1 text-xs text-slate-500">
                Proxy = product pages without an active deal (less contextual meta).
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-sm font-medium text-slate-900">Freshness</div>
            <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Hero forDate</dt>
                <dd className="font-mono text-xs">{health.freshness.heroForDate?.toISOString() ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Last successful ingestion</dt>
                <dd className="font-mono text-xs">
                  {health.freshness.lastSuccessfulIngestionAt?.toISOString() ?? '—'}
                  {health.freshness.lastSuccessfulIngestionSource
                    ? ` (${health.freshness.lastSuccessfulIngestionSource})`
                    : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Last deal updated</dt>
                <dd className="font-mono text-xs">{health.freshness.lastDealUpdatedAt?.toISOString() ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Last product updated</dt>
                <dd className="font-mono text-xs">{health.freshness.lastProductUpdatedAt?.toISOString() ?? '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

