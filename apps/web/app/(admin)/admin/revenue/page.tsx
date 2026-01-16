import Link from 'next/link';

import { getRevenueIntel } from '@/src/server/admin/revenueIntel';
import { formatMoney } from '@/src/lib/format';

function centsToUsd(cents: number) {
  return formatMoney(cents, 'USD');
}

export default async function AdminRevenuePage() {
  const report = await getRevenueIntel({ days: 7 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Revenue intelligence</h1>
        <p className="mt-1 text-sm text-slate-600">
          Internal, auditable yield signals. No external analytics. Insights only.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Assumptions (last 7 days)
        </div>
        <div className="p-4 space-y-2 text-sm text-slate-700">
          <div className="text-xs text-slate-500">Since: {report.since.toISOString()}</div>
          <div className="text-xs text-slate-500">{report.assumptions.note}</div>
          <div className="mt-2 overflow-x-auto">
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
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
            Provider performance
          </div>
          <div className="p-4">
            {report.providerPerformance.length === 0 ? (
              <div className="text-sm text-slate-600">No click data yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Provider</th>
                      <th className="py-2 pr-4">Clicks</th>
                      <th className="py-2 pr-4">Est. revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.providerPerformance.map((r) => (
                      <tr key={r.provider} className="border-t border-slate-200">
                        <td className="py-2 pr-4 font-mono text-xs">{r.provider}</td>
                        <td className="py-2 pr-4 tabular-nums">{r.clicks}</td>
                        <td className="py-2 pr-4 tabular-nums">{centsToUsd(r.estRevenueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
            Revenue by page/section (proxy)
          </div>
          <div className="p-4">
            {report.bySection.length === 0 ? (
              <div className="text-sm text-slate-600">No click data yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Section</th>
                      <th className="py-2 pr-4">Clicks</th>
                      <th className="py-2 pr-4">Est. revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.bySection.slice(0, 20).map((r) => (
                      <tr key={r.section} className="border-t border-slate-200">
                        <td className="py-2 pr-4 font-mono text-xs">{r.section}</td>
                        <td className="py-2 pr-4 tabular-nums">{r.clicks}</td>
                        <td className="py-2 pr-4 tabular-nums">{centsToUsd(r.estRevenueCents)}</td>
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
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Top earning deals (estimated)
        </div>
        <div className="p-4">
          {report.topDeals.length === 0 ? (
            <div className="text-sm text-slate-600">No deal click data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Deal</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Impressions</th>
                    <th className="py-2 pr-4">Clicks</th>
                    <th className="py-2 pr-4">CTR</th>
                    <th className="py-2 pr-4">Est. revenue</th>
                    <th className="py-2 pr-4">Placements</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topDeals.slice(0, 25).map((d) => (
                    <tr key={d.dealId} className="border-t border-slate-200 align-top">
                      <td className="py-2 pr-4">
                        <div className="max-w-[420px]">
                          <Link
                            href={`/p/${encodeURIComponent(d.asin)}`}
                            className="text-sm font-medium text-slate-900 hover:underline"
                          >
                            {d.title}
                          </Link>
                          <div className="mt-1 font-mono text-xs text-slate-500">{d.asin}</div>
                          {d.providers.length > 0 && (
                            <div className="mt-1 text-xs text-slate-600">
                              Providers:{' '}
                              {d.providers.map((p) => `${p.provider} (${p.clicks})`).join(', ')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{d.category}</td>
                      <td className="py-2 pr-4 tabular-nums">{d.impressions}</td>
                      <td className="py-2 pr-4 tabular-nums">{d.clicks}</td>
                      <td className="py-2 pr-4 tabular-nums">{(d.ctr * 100).toFixed(1)}%</td>
                      <td className="py-2 pr-4 tabular-nums">{centsToUsd(d.estRevenueCents)}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {d.placementsActive.length ? d.placementsActive.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Top earning categories (estimated)
        </div>
        <div className="p-4">
          {report.topCategories.length === 0 ? (
            <div className="text-sm text-slate-600">No category click data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Clicks</th>
                    <th className="py-2 pr-4">Est. revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topCategories.map((c) => (
                    <tr key={c.category} className="border-t border-slate-200">
                      <td className="py-2 pr-4 font-mono text-xs">{c.category}</td>
                      <td className="py-2 pr-4 tabular-nums">{c.clicks}</td>
                      <td className="py-2 pr-4 tabular-nums">{centsToUsd(c.estRevenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Suggestions (insights only)
        </div>
        <div className="p-4 space-y-6">
          <div>
            <div className="text-sm font-medium text-slate-900">Premium placement candidates</div>
            <div className="mt-1 text-xs text-slate-600">
              Heuristic: impressions ≥ 50, CTR ≥ 3%, and no active placement.
            </div>
            {report.suggestions.premiumCandidates.length === 0 ? (
              <div className="mt-2 text-sm text-slate-600">No candidates yet.</div>
            ) : (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                {report.suggestions.premiumCandidates.map((d) => (
                  <li key={d.dealId}>
                    <span className="font-mono text-xs">{d.asin}</span> — {d.title} ({(d.ctr * 100).toFixed(1)}% CTR)
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-slate-900">Underperforming placements</div>
            <div className="mt-1 text-xs text-slate-600">
              Heuristic: impressions ≥ 100, CTR &lt; 1%, and has an active placement.
            </div>
            {report.suggestions.underperformingPlacements.length === 0 ? (
              <div className="mt-2 text-sm text-slate-600">None flagged.</div>
            ) : (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                {report.suggestions.underperformingPlacements.map((d) => (
                  <li key={d.dealId}>
                    <span className="font-mono text-xs">{d.asin}</span> — {d.title} ({d.placementsActive.join(', ')} ·{' '}
                    {(d.ctr * 100).toFixed(1)}% CTR)
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-slate-900">Provider suggestions</div>
            <div className="mt-1 text-xs text-slate-600">
              Suggests a higher-EPC provider only when the product has an enabled provider link configured.
            </div>
            {report.suggestions.providerSuggestions.length === 0 ? (
              <div className="mt-2 text-sm text-slate-600">No suggestions yet.</div>
            ) : (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                {report.suggestions.providerSuggestions.map((s) => (
                  <li key={s.dealId}>
                    <span className="font-mono text-xs">{s.asin}</span> — {s.title} (current: {s.current}, suggested:{' '}
                    {s.suggested})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

