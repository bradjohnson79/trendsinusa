import { getPortfolioReport } from '@/src/server/admin/portfolio';
import { formatMoney } from '@/src/lib/format';

function centsToUsd(cents: number) {
  return formatMoney(cents, 'USD');
}

function pct(v: number | null) {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

export default async function AdminPortfolioPage() {
  const report = await getPortfolioReport({ days: 30 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Portfolio</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cross-site control panel focused on clarity. No external analytics.
        </p>
        <div className="mt-2 text-xs text-slate-500">Since: {report.since.toISOString()}</div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Assumptions</div>
        <div className="p-4 text-sm text-slate-700">
          <div className="text-xs text-slate-600">{report.assumptions.note}</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">EPC (cents/click)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.assumptions.epcCentsByProvider).map(([provider, epc]) => (
                  <tr key={provider} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{provider}</td>
                    <td className="py-2 pr-4 tabular-nums">{epc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Portfolio clicks</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{report.totals.clicks}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Portfolio CTR</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{(report.totals.ctr * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Est. portfolio revenue</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{centsToUsd(report.totals.estRevenueCents)}</div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">By site</div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">Site</th>
                <th className="py-2 pr-4">Enabled</th>
                <th className="py-2 pr-4">Impressions</th>
                <th className="py-2 pr-4">Clicks</th>
                <th className="py-2 pr-4">CTR</th>
                <th className="py-2 pr-4">Est. revenue</th>
                <th className="py-2 pr-4">Clicks (7d Δ)</th>
                <th className="py-2 pr-4">Revenue (7d Δ)</th>
                <th className="py-2 pr-4">Live deals</th>
                <th className="py-2 pr-4">Products</th>
                <th className="py-2 pr-4">Last click</th>
              </tr>
            </thead>
            <tbody>
              {report.bySite.map((s) => (
                <tr key={s.site} className="border-t border-slate-200 align-top">
                  <td className="py-2 pr-4 font-mono text-xs">{s.site}</td>
                  <td className="py-2 pr-4">{s.enabled ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.impressions}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.clicks}</td>
                  <td className="py-2 pr-4 tabular-nums">{(s.ctr * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-4 tabular-nums">{centsToUsd(s.estRevenueCents)}</td>
                  <td className="py-2 pr-4 tabular-nums">{pct(s.growth.clicksPct)}</td>
                  <td className="py-2 pr-4 tabular-nums">{pct(s.growth.revenuePct)}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.health.liveDeals}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.health.products}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{s.lastSeenClickAt?.toISOString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Growth trends (daily)</div>
        <div className="p-4 space-y-4 text-sm text-slate-700">
          <div className="text-xs text-slate-600">
            For clarity, this shows daily clicks + estimated revenue per site. (We can add sparklines later if desired.)
          </div>
          {report.bySite.map((s) => (
            <div key={s.site} className="rounded-md border border-slate-200 p-3">
              <div className="text-sm font-semibold text-slate-900">{s.site}</div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1 pr-3">Day</th>
                      <th className="py-1 pr-3">Imps</th>
                      <th className="py-1 pr-3">Clicks</th>
                      <th className="py-1 pr-3">Est. rev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.series.slice(-14).map((r) => (
                      <tr key={r.day} className="border-t border-slate-200">
                        <td className="py-1 pr-3 font-mono">{r.day}</td>
                        <td className="py-1 pr-3 tabular-nums">{r.impressions}</td>
                        <td className="py-1 pr-3 tabular-nums">{r.clicks}</td>
                        <td className="py-1 pr-3 tabular-nums">{centsToUsd(r.estRevenueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

