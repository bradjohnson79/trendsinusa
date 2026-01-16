import { getExitReport } from '@/src/server/admin/exitReport';
import { formatMoney } from '@/src/lib/format';

function centsToUsd(cents: number) {
  return formatMoney(Math.round(cents), 'USD');
}

function pct(v: number | null) {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

export default async function AdminExitPage() {
  const report = await getExitReport({ months: 12 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Exit readiness</h1>
        <p className="mt-1 text-sm text-slate-600">
          Exit-grade reporting (normalized). Dashboards + documentation only.
        </p>
        <div className="mt-2 text-xs text-slate-500">Since: {report.since.toISOString()}</div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Assumptions & normalization</div>
        <div className="p-4 text-sm text-slate-700 space-y-2">
          <div className="text-xs text-slate-600">{report.assumptions.note}</div>
          <div className="text-xs text-slate-600">
            Revenue per visitor uses: <span className="font-mono">{report.assumptions.visitorDefinition}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Portfolio monthly (normalized)</div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">Month</th>
                <th className="py-2 pr-4">Impressions</th>
                <th className="py-2 pr-4">Clicks</th>
                <th className="py-2 pr-4">CTR</th>
                <th className="py-2 pr-4">Est. revenue</th>
                <th className="py-2 pr-4">Rev / visitor</th>
                <th className="py-2 pr-4">MoM clicks</th>
                <th className="py-2 pr-4">MoM revenue</th>
              </tr>
            </thead>
            <tbody>
              {report.portfolio.map((r, idx) => (
                <tr key={r.month} className="border-t border-slate-200">
                  <td className="py-2 pr-4 font-mono text-xs">{r.month}</td>
                  <td className="py-2 pr-4 tabular-nums">{r.impressions}</td>
                  <td className="py-2 pr-4 tabular-nums">{r.clicks}</td>
                  <td className="py-2 pr-4 tabular-nums">{(r.ctr * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-4 tabular-nums">{centsToUsd(r.estRevenueCents)}</td>
                  <td className="py-2 pr-4 tabular-nums">{centsToUsd(r.estRevPerVisitorCents)}</td>
                  <td className="py-2 pr-4 tabular-nums">{pct(report.mom[idx]?.clicksMom ?? null)}</td>
                  <td className="py-2 pr-4 tabular-nums">{pct(report.mom[idx]?.revMom ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Revenue by site (last month)</div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">Site</th>
                <th className="py-2 pr-4">Last month revenue (est.)</th>
                <th className="py-2 pr-4">Rev / visitor (est.)</th>
                <th className="py-2 pr-4">Provider dependency (top share)</th>
                <th className="py-2 pr-4">Revenue by stream</th>
                <th className="py-2 pr-4">Revenue by provider</th>
              </tr>
            </thead>
            <tbody>
              {report.bySiteMonthly.map((s) => {
                const last = s.series[s.series.length - 1]!;
                return (
                  <tr key={s.site} className="border-t border-slate-200 align-top">
                    <td className="py-2 pr-4 font-mono text-xs">{s.site}</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(last.estRevenueCents)}</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(last.estRevPerVisitorCents)}</td>
                    <td className="py-2 pr-4 tabular-nums">{(s.providerDependencyTopShare * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-4 text-xs text-slate-700">
                      {s.lastMonthStreams.length === 0
                        ? '—'
                        : s.lastMonthStreams
                            .map((x) => `${x.stream}: ${centsToUsd(x.estRevenueCents)} (${(x.share * 100).toFixed(0)}%)`)
                            .join(', ')}
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-700">
                      {s.lastMonthProviders.length === 0
                        ? '—'
                        : s.lastMonthProviders
                            .map((x) => `${x.provider}: ${centsToUsd(x.estRevenueCents)} (${(x.share * 100).toFixed(0)}%)`)
                            .join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

