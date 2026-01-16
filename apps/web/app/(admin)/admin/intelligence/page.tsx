import { getCrossSiteIntel } from '@/src/server/admin/crossSiteIntel';
import { formatMoney } from '@/src/lib/format';

function centsToUsd(cents: number) {
  return formatMoney(cents, 'USD');
}

export default async function AdminIntelligencePage() {
  const report = await getCrossSiteIntel({ days: 30 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cross-site intelligence</h1>
        <p className="mt-1 text-sm text-slate-600">
          Aggregated learning across sites. Internal-only, auditable, insights-only.
        </p>
        <div className="mt-2 text-xs text-slate-500">Since: {report.since.toISOString()}</div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Assumptions</div>
        <div className="p-4">
          <div className="text-xs text-slate-600">Estimated revenue uses EPC (cents per outbound click) by provider.</div>
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">CTR by site</div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Site</th>
                  <th className="py-2 pr-4">Impressions</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">CTR</th>
                </tr>
              </thead>
              <tbody>
                {report.bySite.map((s) => (
                  <tr key={s.site} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{s.site}</td>
                    <td className="py-2 pr-4 tabular-nums">{s.impressions}</td>
                    <td className="py-2 pr-4 tabular-nums">{s.clicks}</td>
                    <td className="py-2 pr-4 tabular-nums">{(s.ctr * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Provider performance (overall)</div>
          <div className="p-4">
            {report.recommendations.providerWinners.length === 0 ? (
              <div className="text-sm text-slate-600">No click data yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Provider</th>
                      <th className="py-2 pr-4">Est. revenue</th>
                      <th className="py-2 pr-4">EPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.recommendations.providerWinners.map((p) => (
                      <tr key={p.provider} className="border-t border-slate-200">
                        <td className="py-2 pr-4 font-mono text-xs">{p.provider}</td>
                        <td className="py-2 pr-4 tabular-nums">{centsToUsd(p.estRevenueCents)}</td>
                        <td className="py-2 pr-4 tabular-nums">{p.epcCents}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Winning categories (estimated)</div>
        <div className="p-4 overflow-x-auto">
          {report.topCategories.length === 0 ? (
            <div className="text-sm text-slate-600">No category-linked click data yet.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Est. revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.topCategories.map((c) => (
                  <tr key={c.category} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{c.category}</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(c.estRevenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Winning price bands</div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Band</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">Est. revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.byPriceBand.map((b) => (
                  <tr key={b.band} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{b.band}</td>
                    <td className="py-2 pr-4 tabular-nums">{b.clicks}</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(b.estRevenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Time-to-expiry conversion (clicks)</div>
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
                {report.byTimeToExpiry.map((b) => (
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

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Copy patterns (tracked variants)</div>
        <div className="p-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="text-sm font-medium text-slate-900">Top CTA variants</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
              {report.copy.topCtas.map((c) => (
                <li key={c.cta}>
                  <span className="font-mono text-xs">{c.cta}</span> — {c.clicks} clicks
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900">Top badge variants</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
              {report.copy.topBadges.map((b) => (
                <li key={b.badge}>
                  <span className="font-mono text-xs">{b.badge}</span> — {b.clicks} clicks
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Recommendations (insights only)</div>
        <div className="p-4 space-y-4 text-sm text-slate-700">
          <div>
            <div className="font-medium text-slate-900">Category focus for new sites</div>
            <div className="mt-1 font-mono text-xs">{report.recommendations.categoryFocusForNewSites.join(', ') || '—'}</div>
          </div>
          <div>
            <div className="font-medium text-slate-900">Price bands to emphasize</div>
            <div className="mt-1 font-mono text-xs">{report.recommendations.priceBandsToEmphasize.join(', ') || '—'}</div>
          </div>
          <div className="text-xs text-slate-500">
            {report.recommendations.notes.map((n) => (
              <div key={n}>- {n}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

