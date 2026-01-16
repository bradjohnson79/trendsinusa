import { getAdminDashboardMetrics } from '@/src/server/admin/queries';
import { getAdminDbStatus } from '@/src/server/admin/dbStatus';
import { getOpsHealth } from '@/src/server/admin/health';

export default async function AdminDashboardPage() {
  const db = await getAdminDbStatus();
  const health = await getOpsHealth();

  const metrics =
    db.status === 'ready'
      ? await getAdminDashboardMetrics()
      : {
          liveDealsCount: 0,
          expiring: { in1h: 0, in6h: 0, in24h: 0 },
          newProductsToday: 0,
          aiActionsLast24h: 0,
          affiliateClicks: { today: 0, last7d: 0 },
          alerts: [],
        };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Command center (read-only). Alerts and health signals should show up here first.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Ops health</div>
        <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Last ingestion</div>
            <div className="mt-1 font-mono text-xs">
              {health.lastIngestion?.finishedAt?.toISOString() ?? '—'}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {health.lastIngestion?.status ?? '—'}
              {health.lastIngestionAgeMinutes != null ? ` · ${health.lastIngestionAgeMinutes}m ago` : ''}
            </div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Ingestion failures (24h)</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{health.ingestionFailures24h}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">AI failures (24h)</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{health.aiFailures24h}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">DB status</div>
            <div className="mt-1 text-sm font-medium">{db.status}</div>
          </div>
        </div>
        {health.lastIngestion?.status === 'FAILURE' && health.lastIngestion.error ? (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
            Last ingestion error: <span className="font-mono">{health.lastIngestion.error}</span>
          </div>
        ) : null}
      </div>

      {db.status !== 'ready' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">Database status</div>
          {db.status === 'needs_migration' ? (
            <div className="mt-2 space-y-2 text-sm text-amber-900">
              <div>
                Schema is out of date.
              </div>
              {db.missingTables.length > 0 && (
                <div>
                  Missing tables:{' '}
                  <span className="font-mono text-xs">{db.missingTables.join(', ')}</span>
                </div>
              )}
              {Object.keys(db.missingColumns).length > 0 && (
                <div className="space-y-1">
                  <div>Missing columns:</div>
                  <ul className="list-disc pl-5 font-mono text-xs">
                    {Object.entries(db.missingColumns).map(([table, cols]) => (
                      <li key={table}>
                        {table}: {cols.join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-xs text-amber-800">
                Run: <span className="rounded bg-amber-100 px-2 py-1 font-mono">pnpm prisma:migrate:deploy</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-sm text-amber-900">
              <div>Database is unreachable.</div>
              <div className="rounded bg-amber-100 p-2 font-mono text-xs text-amber-900 break-all">
                {db.message}
              </div>
            </div>
          )}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-900">🔥 Live deals</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{metrics.liveDealsCount}</div>
          <div className="mt-2 text-xs text-slate-500">ACTIVE, expiresAt &gt; now</div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-900">⏳ Expiring soon</div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">1h</div>
              <div className="text-lg font-semibold tabular-nums">{metrics.expiring.in1h}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">6h</div>
              <div className="text-lg font-semibold tabular-nums">{metrics.expiring.in6h}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">24h</div>
              <div className="text-lg font-semibold tabular-nums">{metrics.expiring.in24h}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">Same filters as live deals</div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-900">🆕 Products ingested today</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{metrics.newProductsToday}</div>
          <div className="mt-2 text-xs text-slate-500">Product.createdAt ≥ start of day</div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-900">🧠 AI actions (last 24h)</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{metrics.aiActionsLast24h}</div>
          <div className="mt-2 text-xs text-slate-500">AIActionLog.startedAt ≥ now − 24h</div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-900">💸 Estimated affiliate clicks</div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Today</div>
              <div className="text-lg font-semibold tabular-nums">{metrics.affiliateClicks.today}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Last 7d</div>
              <div className="text-lg font-semibold tabular-nums">{metrics.affiliateClicks.last7d}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">ClickEvent.kind = AFFILIATE_OUTBOUND</div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-900">⚠️ Alerts</div>
          {metrics.alerts.length === 0 ? (
            <div className="mt-2 text-sm text-slate-600">No active alerts.</div>
          ) : (
            <ul className="mt-2 space-y-2">
              {metrics.alerts.map((a) => (
                <li key={a.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  <div className="font-medium">{a.type}</div>
                  <div className="text-slate-600">{a.message}</div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 text-xs text-slate-500">Latest non-noisy, unresolved</div>
        </div>
      </section>
    </div>
  );
}

