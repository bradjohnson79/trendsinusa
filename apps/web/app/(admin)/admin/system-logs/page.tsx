import { prisma } from '@/src/server/prisma';
import { cookies } from 'next/headers';
import { getServerEnv } from '@trendsinusa/shared';
import { requestAmazonDealsRefresh, requestAmazonProductsRefresh, setDealApproved, setDealSuppressed, setProductBlocked } from './actions';

export default async function AdminSystemLogsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const env = getServerEnv();
  const store = await cookies();
  const siteKey = store.get('tui_admin_site')?.value ?? env.SITE_KEY;

  const sp = await props.searchParams;
  const asin = typeof sp.asin === 'string' ? sp.asin.trim().toUpperCase() : '';

  const [runs, commands, raw, recentDeals] = await Promise.all([
    prisma.ingestionRun.findMany({ orderBy: { startedAt: 'desc' }, take: 50 }),
    prisma.systemCommand.findMany({ orderBy: { requestedAt: 'desc' }, take: 20 }),
    asin
      ? prisma.productRawPayload.findFirst({
          where: { provider: 'AMAZON', product: { asin } },
          orderBy: { fetchedAt: 'desc' },
          select: { fetchedAt: true, payload: true, payloadHash: true, product: { select: { asin: true, title: true } } },
        })
      : Promise.resolve(null),
    prisma.deal.findMany({
      where: { source: { in: ['AMAZON_DEAL', 'AMAZON_BEST_SELLER', 'AMAZON_LIGHTNING'] } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: { product: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">System &amp; Logs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Auditable runs, errors with stack traces, and emergency controls (pause/resume automations).
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Site: <span className="font-mono">{siteKey}</span>
        </p>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Ingestion runs
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Products</th>
                <th className="py-2 pr-4">Deals</th>
                <th className="py-2 pr-4">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-600">{r.startedAt.toISOString()}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.source}</td>
                  <td className="py-2 pr-4 text-xs">{r.status}</td>
                  <td className="py-2 pr-4 text-xs tabular-nums">{r.productsProcessed ?? 0}</td>
                  <td className="py-2 pr-4 text-xs tabular-nums">{r.dealsProcessed ?? 0}</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{r.error ? r.error.slice(0, 120) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Manual refresh (rate-limited)
        </div>
        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-600">
            These buttons enqueue a refresh request. The next hourly worker run will execute it (no direct DB authoring).
          </div>
          <div className="flex flex-wrap gap-3">
            <form action={requestAmazonProductsRefresh}>
              <button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800" type="submit">
                Request Amazon products refresh
              </button>
            </form>
            <form action={requestAmazonDealsRefresh}>
              <button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800" type="submit">
                Request Amazon deals refresh
              </button>
            </form>
          </div>

          <div className="rounded-md border border-slate-200">
            <div className="border-b border-slate-200 p-3 text-xs font-medium text-slate-900">Queued commands</div>
            <div className="p-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Requested</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Processed</th>
                    <th className="py-2 pr-4">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commands.map((c) => (
                    <tr key={c.id} className="align-top">
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-600">{c.requestedAt.toISOString()}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{c.type}</td>
                      <td className="py-2 pr-4 text-xs">{c.status}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-slate-600">{c.processedAt ? c.processedAt.toISOString() : '—'}</td>
                      <td className="py-2 pr-4 text-xs text-slate-600">{c.error ? c.error.slice(0, 120) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Deal approval & suppression (override-only)
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-slate-600">
            Latest Amazon-sourced deals (read-first). Overrides are explicit toggles.
          </div>
          <div className="space-y-3">
            {recentDeals.map((d) => (
              <div key={d.id} className="rounded-md border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-900">{d.product.title}</div>
                <div className="mt-1 text-xs text-slate-600 font-mono">dealId={d.id} asin={d.product.asin}</div>
                <div className="mt-2 flex flex-wrap gap-4">
                  <form action={setDealApproved} className="flex items-center gap-2">
                    <input type="hidden" name="dealId" value={d.id} />
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input type="checkbox" name="approved" defaultChecked={d.approved} />
                      Approved
                    </label>
                    <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" type="submit">
                      Save
                    </button>
                  </form>

                  <form action={setDealSuppressed} className="flex items-center gap-2">
                    <input type="hidden" name="dealId" value={d.id} />
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input type="checkbox" name="suppressed" defaultChecked={d.suppressed} />
                      Suppressed
                    </label>
                    <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" type="submit">
                      Save
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Suppress product (block) + raw Amazon payload (read-only)
        </div>
        <div className="p-4 space-y-4">
          <form action={setProductBlocked} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700" htmlFor="asin">
                ASIN
              </label>
              <input
                id="asin"
                name="asin"
                defaultValue={asin}
                placeholder="B0..."
                className="mt-1 w-56 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="blocked" />
              Block product
            </label>
            <button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800" type="submit">
              Apply
            </button>
          </form>

          <div className="text-xs text-slate-500">
            To view raw payload, open this page with <code className="rounded bg-slate-100 px-1">?asin=ASIN</code>.
          </div>

          {asin ? (
            raw ? (
              <div className="rounded-md border border-slate-200">
                <div className="border-b border-slate-200 p-3 text-xs text-slate-600">
                  <span className="font-mono">{raw.product.asin}</span> • {raw.product.title} • fetched {raw.fetchedAt.toISOString()} • hash{' '}
                  <span className="font-mono">{raw.payloadHash ?? '—'}</span>
                </div>
                <pre className="max-h-[420px] overflow-auto p-3 text-[11px] leading-5 text-slate-800">
                  {JSON.stringify(raw.payload, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                No raw Amazon payload found for this ASIN yet.
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

