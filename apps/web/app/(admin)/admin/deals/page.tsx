import type { IngestionSource } from '@prisma/client';
import { DealsTable } from './DealsTable';
import { getAdminDeals } from '@/src/server/admin/deals';

const SOURCES: Array<IngestionSource | 'all'> = ['all', 'AMAZON_BEST_SELLER', 'AMAZON_LIGHTNING', 'AMAZON_DEAL', 'MANUAL'];

const STATUS = ['all', 'live', 'expiring', 'scheduled', 'paused', 'expired'] as const;
type StatusFilter = (typeof STATUS)[number];
const WINDOWS = ['all', '1h', '6h', '24h'] as const;
type WindowFilter = (typeof WINDOWS)[number];

function asStatus(v: string): StatusFilter {
  return (STATUS.includes(v as StatusFilter) ? v : 'all') as StatusFilter;
}
function asWindow(v: string): WindowFilter {
  return (WINDOWS.includes(v as WindowFilter) ? v : 'all') as WindowFilter;
}
function asSource(v: string): IngestionSource | 'all' {
  return SOURCES.includes(v as IngestionSource | 'all') ? (v as IngestionSource | 'all') : 'all';
}

export default async function AdminDealsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const status = asStatus(String(sp.status ?? 'all'));
  const window = asWindow(String(sp.window ?? 'all'));
  const site = String(sp.site ?? 'all');
  const category = String(sp.category ?? '');
  const source = asSource(String(sp.source ?? 'all'));
  const q = String(sp.q ?? '');
  const cursor = sp.cursor ? String(sp.cursor) : null;

  const { deals, nextCursor, sites } = await getAdminDeals({
    limit: 50,
    cursor,
    filters: { status, window, site, category, source, q },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Deals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Production control console. No manual price edits. Control visibility, urgency, and priority only.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Filters</div>
        <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6" action="/admin/deals" method="get">
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
              {sites
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
            <input
              name="q"
              defaultValue={q}
              placeholder="ASIN or title"
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>

          <div className="md:col-span-6 flex items-center gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">Apply</button>
            <a className="text-sm text-slate-600 underline" href="/admin/deals">
              Reset
            </a>
            {cursor ? (
              <span className="ml-auto text-xs text-slate-500">
                Paging cursor active (filters apply on this page only). Use Reset to go back to first page.
              </span>
            ) : null}
          </div>
        </form>
      </div>

      <DealsTable deals={deals} />

      {nextCursor ? (
        <div className="flex justify-center">
          <a
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            href={`/admin/deals?status=${encodeURIComponent(status)}&window=${encodeURIComponent(window)}&site=${encodeURIComponent(site)}&category=${encodeURIComponent(
              category,
            )}&source=${encodeURIComponent(source)}&q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(nextCursor)}`}
          >
            Load more
          </a>
        </div>
      ) : null}
    </div>
  );
}

