import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ApiIngestionSource as IngestionSource } from '@trendsinusa/shared/api';
import { AdminEmptyState, AdminError, AdminLoading, AdminSection } from '@/components/admin/AdminPrimitives';
import { useAdminDeals } from '@/hooks/admin/useAdminDeals';
import { DealsTable } from '@/routes/admin/deals/DealsTable';

const SOURCES: Array<IngestionSource | 'all'> = ['all', 'AMAZON_BEST_SELLER', 'AMAZON_LIGHTNING', 'AMAZON_DEAL', 'MANUAL'];
const STATUS = ['all', 'live', 'expiring', 'scheduled', 'paused', 'expired'] as const;
const WINDOWS = ['all', '1h', '6h', '24h'] as const;

type StatusFilter = (typeof STATUS)[number];
type WindowFilter = (typeof WINDOWS)[number];

function asStatus(v: string | null): StatusFilter {
  const s = String(v ?? 'all');
  return (STATUS.includes(s as StatusFilter) ? s : 'all') as StatusFilter;
}
function asWindow(v: string | null): WindowFilter {
  const s = String(v ?? 'all');
  return (WINDOWS.includes(s as WindowFilter) ? s : 'all') as WindowFilter;
}
function asSource(v: string | null): IngestionSource | 'all' {
  const s = String(v ?? 'all');
  return SOURCES.includes(s as IngestionSource | 'all') ? (s as IngestionSource | 'all') : 'all';
}

export function AdminDealsPage() {
  const [sp, setSp] = useSearchParams();

  const status = asStatus(sp.get('status'));
  const window = asWindow(sp.get('window'));
  const site = sp.get('site') ?? 'all';
  const category = sp.get('category') ?? '';
  const source = asSource(sp.get('source'));
  const q = sp.get('q') ?? '';

  const query = useMemo(
    () => ({ status, window, site, category, source, q }),
    [status, window, site, category, source, q],
  );

  const dealsQ = useAdminDeals(query);

  return (
    <AdminSection
      title="Deals"
      description="Production control console. No manual price edits. Control visibility, urgency, and priority only."
    >
      {dealsQ.loading ? <AdminLoading /> : null}
      {dealsQ.errorMessage ? <AdminError message={dealsQ.errorMessage} onRetry={dealsQ.reload} /> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Filters</div>
        <form
          className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const next: Record<string, string> = {};
            for (const [k, v] of fd.entries()) next[k] = String(v);
            setSp(next);
          }}
        >
          <label className="text-xs text-slate-600">
            Status
            <select name="status" defaultValue={status} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              <option value="all">All</option>
              <option value="live">Live</option>
              <option value="expiring">Expiring</option>
              <option value="scheduled">Scheduled</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Time window
            <select name="window" defaultValue={window} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              <option value="all">All</option>
              <option value="1h">≤ 1h</option>
              <option value="6h">≤ 6h</option>
              <option value="24h">≤ 24h</option>
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Site
            <select name="site" defaultValue={site} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              <option value="all">All</option>
              {dealsQ.sites
                .filter((s) => s.enabled)
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.key}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Category
            <input
              name="category"
              defaultValue={category}
              placeholder="e.g. electronics"
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>

          <label className="text-xs text-slate-600">
            Source
            <select name="source" defaultValue={source} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Search
            <input name="q" defaultValue={q} placeholder="ASIN or title" className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" />
          </label>

          <div className="md:col-span-6 flex items-center gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">Apply</button>
            <button
              type="button"
              className="text-sm text-slate-600 underline"
              onClick={() => setSp({})}
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {!dealsQ.loading && !dealsQ.errorMessage ? (
        dealsQ.deals && dealsQ.deals.length ? (
          <DealsTable deals={dealsQ.deals} onMutateDone={() => dealsQ.reload()} />
        ) : (
          <AdminEmptyState title="No deals yet" description="When deals are ingested or scheduled, they’ll appear here." />
        )
      ) : null}

      {dealsQ.nextCursor ? (
        <div className="flex justify-center">
          <button
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
            disabled={dealsQ.loadingMore}
            onClick={() => void dealsQ.loadMore()}
          >
            {dealsQ.loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </AdminSection>
  );
}

