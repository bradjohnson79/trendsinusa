import { getHoldReport } from '@/src/server/admin/hold';
import { formatMoney } from '@/src/lib/format';

function centsToUsd(cents: number) {
  return formatMoney(cents, 'USD');
}

export default async function AdminHoldPage() {
  const report = await getHoldReport({ days: 30 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Hold strategy</h1>
        <p className="mt-1 text-sm text-slate-600">
          Owner-grade cash-flow and stability view. Insights only (no automation changes).
        </p>
        <div className="mt-2 text-xs text-slate-500">Since: {report.since.toISOString()}</div>
      </div>

      {report.alerts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Risk alerts</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-800">
            {report.alerts.map((a, idx) => (
              <li key={idx}>{a.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Impressions (proxy)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{report.totals.impressions}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Clicks</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{report.totals.clicks}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">CTR</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{(report.totals.ctr * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Est. revenue</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{centsToUsd(report.totals.estRevenueCents)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Top revenue categories</div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Est. revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.drivers.topCategories.map((c) => (
                  <tr key={c.category} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{c.category}</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(c.estRevenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Provider yield & dependency</div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Est. revenue</th>
                  <th className="py-2 pr-4">Share</th>
                </tr>
              </thead>
              <tbody>
                {report.drivers.topProviders.map((p) => (
                  <tr key={p.provider} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{p.provider}</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(p.estRevenueCents)}</td>
                    <td className="py-2 pr-4 tabular-nums">{(p.share * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">High-conversion deal states</div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Deal state</th>
                  <th className="py-2 pr-4">Est. revenue</th>
                  <th className="py-2 pr-4">Share</th>
                </tr>
              </thead>
              <tbody>
                {report.drivers.byDealState.map((s) => (
                  <tr key={s.dealStatus} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{s.dealStatus}</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(s.estRevenueCents)}</td>
                    <td className="py-2 pr-4 tabular-nums">{(s.share * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Time-to-expiry conversion</div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Bucket</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">Est. revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.timeToExpiry.map((b) => (
                  <tr key={b.bucket} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{b.bucket}</td>
                    <td className="py-2 pr-4 tabular-nums">{b.clicks}</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(b.estRevenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Predictability</div>
          <div className="p-4 space-y-3 text-sm text-slate-700">
            <div>
              <span className="font-medium text-slate-900">Volatility (CV)</span>: {report.stability.coefficientOfVariation.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500">
              CV is coefficient of variation of daily estimated revenue. Lower is “quieter”.
            </div>
            {report.stability.byDow.length > 0 && (
              <div className="mt-2">
                <div className="text-sm font-medium text-slate-900">Seasonal hint (day-of-week revenue)</div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">DOW (UTC)</th>
                        <th className="py-2 pr-4">Est. revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.stability.byDow.map((d) => (
                        <tr key={d.dow} className="border-t border-slate-200">
                          <td className="py-2 pr-4 tabular-nums">{d.dow}</td>
                          <td className="py-2 pr-4 tabular-nums">{centsToUsd(d.estRevenueCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Operational cost (proxy)</div>
          <div className="p-4 space-y-2 text-sm text-slate-700">
            <div>
              Ingestion runs: <span className="tabular-nums">{report.ops.ingestionRuns.total}</span> (failed:{' '}
              <span className="tabular-nums">{report.ops.ingestionRuns.failed}</span>)
            </div>
            <div>
              Avg run duration:{' '}
              <span className="tabular-nums">
                {report.ops.ingestionRuns.avgDurationMs == null ? '—' : `${report.ops.ingestionRuns.avgDurationMs}ms`}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              This is a cost proxy only. No ingestion cadence changes are made automatically.
            </div>
          </div>
        </div>
      </div>

      {report.recommendations.length > 0 && (
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Recommendations (manual)</div>
          <div className="p-4">
            <ul className="list-disc pl-5 text-sm text-slate-700">
              {report.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

