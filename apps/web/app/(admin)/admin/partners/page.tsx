import { getPartnerMetrics } from '@/src/server/admin/partners';
import { formatMoney } from '@/src/lib/format';

function centsToUsd(cents: number) {
  return formatMoney(cents, 'USD');
}

export default async function AdminPartnersPage() {
  const report = await getPartnerMetrics({ days: 30 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Partners</h1>
        <p className="mt-1 text-sm text-slate-600">
          Strategic partnership surfaces with isolation + attribution. No deals signed yet.
        </p>
        <div className="mt-2 text-xs text-slate-500">Since: {report.since.toISOString()}</div>
        <div className="mt-1 text-xs text-slate-500">
          Config file: <span className="font-mono">{report.partnersConfigPath}</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Portfolio totals (30d)</div>
        <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Impressions</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{report.totals.impressions}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Clicks</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{report.totals.clicks}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Est. revenue</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{centsToUsd(report.totals.estRevenueCents)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Partner performance (30d)</div>
        <div className="p-4 overflow-x-auto">
          {report.partners.length === 0 ? (
            <div className="text-sm text-slate-600">No partners configured.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Partner</th>
                  <th className="py-2 pr-4">Enabled</th>
                  <th className="py-2 pr-4">Site</th>
                  <th className="py-2 pr-4">Scopes</th>
                  <th className="py-2 pr-4">Imps</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">CTR</th>
                  <th className="py-2 pr-4">Est. revenue</th>
                  <th className="py-2 pr-4">Share of clicks</th>
                  <th className="py-2 pr-4">Share of revenue</th>
                  <th className="py-2 pr-4">Provider mix</th>
                  <th className="py-2 pr-4">Cannibalization (proxy)</th>
                </tr>
              </thead>
              <tbody>
                {report.partners.map((p) => (
                  <tr key={p.key} className="border-t border-slate-200 align-top">
                    <td className="py-2 pr-4 font-mono text-xs">{p.key}</td>
                    <td className="py-2 pr-4">{p.enabled ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.siteKey}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.scopes.join(', ')}</td>
                    <td className="py-2 pr-4 tabular-nums">{p.impressions}</td>
                    <td className="py-2 pr-4 tabular-nums">{p.clicks}</td>
                    <td className="py-2 pr-4 tabular-nums">{(p.ctr * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(p.estRevenueCents)}</td>
                    <td className="py-2 pr-4 tabular-nums">{(p.shareOfClicks * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-4 tabular-nums">{(p.shareOfRevenue * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-4 text-xs text-slate-700">
                      {p.providerBreakdown.length === 0
                        ? '—'
                        : p.providerBreakdown
                            .map((x) => `${x.provider}: ${centsToUsd(x.estRevenueCents)}`)
                            .join(', ')}
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-700">
                      {p.cannibalizationProxy.totalPartnerDealsClicked === 0
                        ? '—'
                        : `${p.cannibalizationProxy.overlappingDeals}/${p.cannibalizationProxy.totalPartnerDealsClicked} (${(p.cannibalizationProxy.overlapRate * 100).toFixed(0)}%)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Safeguards</div>
        <div className="p-4 text-sm text-slate-700 space-y-2">
          <div>
            - **Partner isolation**: partner config is gated by `config/partners.json` + secret token env var. Disabled partners 404.
          </div>
          <div>
            - <strong>Attribution</strong>: partner traffic is tagged via <code>partner=&lt;key&gt;</code> in tracking referrers and outbound redirects.
          </div>
          <div>
            - **Rate limits**: partner feeds + outbound redirects use the same rate limiting hooks.
          </div>
          <div className="text-xs text-slate-500">
            Notes: {report.assumptions.notes.join(' ')}
          </div>
        </div>
      </div>
    </div>
  );
}

