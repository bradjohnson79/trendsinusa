import { getSignals } from '@/src/server/signals/core';
import { formatMoney } from '@/src/lib/format';

function centsToUsd(cents: number) {
  return formatMoney(cents, 'USD');
}

export default async function AdminSignalsPage() {
  const report = await getSignals({ days: 30, tier: 'pro' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Signals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Privacy-safe, aggregated intelligence outputs. No raw user data. No partner leakage.
        </p>
        <div className="mt-2 text-xs text-slate-500">Since: {report.since.toISOString()}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Impressions</div>
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

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Category momentum</div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Δ share (7d)</th>
                <th className="py-2 pr-4">Clicks</th>
                <th className="py-2 pr-4">Imps</th>
                <th className="py-2 pr-4">Est. rev</th>
              </tr>
            </thead>
            <tbody>
              {report.outputs.categoryMomentum.map((r) => (
                <tr key={r.category} className="border-t border-slate-200">
                  <td className="py-2 pr-4 font-mono text-xs">{r.category}</td>
                  <td className="py-2 pr-4 tabular-nums">{(r.deltaShare * 100).toFixed(2)}%</td>
                  <td className="py-2 pr-4 tabular-nums">{r.clicks}</td>
                  <td className="py-2 pr-4 tabular-nums">{r.impressions}</td>
                  <td className="py-2 pr-4 tabular-nums">{centsToUsd(r.estRevenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Conversion signals</div>
          <div className="p-4 space-y-4">
            <div>
              <div className="text-sm font-medium text-slate-900">Deal lifecycle pattern</div>
              <div className="mt-1 text-sm text-slate-700">
                Avg lifetime: {report.outputs.lifecycle.avgLifetimeHours == null ? '—' : `${report.outputs.lifecycle.avgLifetimeHours.toFixed(1)}h`} (samples:{' '}
                {report.outputs.lifecycle.samples})
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">Time-to-expiry</div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Bucket</th>
                      <th className="py-2 pr-4">Clicks</th>
                      <th className="py-2 pr-4">Est. rev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.outputs.timeToExpiry.map((b) => (
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
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Providers & deal states</div>
          <div className="p-4 space-y-4">
            <div>
              <div className="text-sm font-medium text-slate-900">Providers</div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Provider</th>
                      <th className="py-2 pr-4">Clicks</th>
                      <th className="py-2 pr-4">Est. rev</th>
                      <th className="py-2 pr-4">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.outputs.providers.map((p) => (
                      <tr key={p.provider} className="border-t border-slate-200">
                        <td className="py-2 pr-4 font-mono text-xs">{p.provider}</td>
                        <td className="py-2 pr-4 tabular-nums">{p.clicks}</td>
                        <td className="py-2 pr-4 tabular-nums">{centsToUsd(p.estRevenueCents)}</td>
                        <td className="py-2 pr-4 tabular-nums">{(p.share * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-slate-900">Deal states</div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">State</th>
                      <th className="py-2 pr-4">Clicks</th>
                      <th className="py-2 pr-4">Est. rev</th>
                      <th className="py-2 pr-4">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.outputs.dealStates.map((s) => (
                      <tr key={s.dealStatus} className="border-t border-slate-200">
                        <td className="py-2 pr-4 font-mono text-xs">{s.dealStatus}</td>
                        <td className="py-2 pr-4 tabular-nums">{s.clicks}</td>
                        <td className="py-2 pr-4 tabular-nums">{centsToUsd(s.estRevenueCents)}</td>
                        <td className="py-2 pr-4 tabular-nums">{(s.share * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {'priceVolatility' in report.outputs && (
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Price volatility (proxy)</div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Samples</th>
                  <th className="py-2 pr-4">Mean discount</th>
                  <th className="py-2 pr-4">Std dev</th>
                </tr>
              </thead>
              <tbody>
                {report.outputs.priceVolatility.map((r) => (
                  <tr key={r.category} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{r.category}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.samples}</td>
                    <td className="py-2 pr-4 tabular-nums">{(r.discountMean * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-4 tabular-nums">{(r.discountStdDev * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

