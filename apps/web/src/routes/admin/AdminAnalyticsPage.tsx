import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { AdminAnalyticsResponse } from '@trendsinusa/shared/api';
import { api, ApiClientError } from '@/lib/api';

export function AdminAnalyticsPage() {
  const [sp, setSp] = useSearchParams();
  const selectedSiteParam = sp.get('site') ?? undefined;

  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selectedSite = useMemo(() => selectedSiteParam ?? data?.selectedSite ?? '', [selectedSiteParam, data?.selectedSite]);

  useEffect(() => {
    const ac = new AbortController();
    api.admin
      .analytics(ac.signal, selectedSiteParam ? { site: selectedSiteParam } : undefined)
      .then((r) => setData(r))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErr(e instanceof ApiClientError ? e.message : 'Failed to load analytics');
      });
    return () => ac.abort();
  }, [selectedSiteParam]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">Lean, useful metrics for Phase 1. Signal without noise.</p>
      </div>

      {err ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}
      {!data ? <div className="text-sm text-slate-600">Loading…</div> : null}

      {data ? (
        <>
          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Google Analytics (GA4)</div>
            <div className="p-4 space-y-4">
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const site = (e.currentTarget.elements.namedItem('site') as HTMLSelectElement | null)?.value ?? '';
                  setSp(site ? { site } : {});
                }}
              >
                <label className="grid gap-1">
                  <div className="text-xs font-medium text-slate-700">Site</div>
                  <select
                    name="site"
                    value={selectedSite}
                    onChange={(e) => setSp(e.target.value ? { site: e.target.value } : {})}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    {data.sites.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.key} — {s.name}
                        {s.enabled ? '' : ' (disabled)'}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800">Switch</button>
              </form>

              <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-1">
                  <div className="text-xs font-medium text-slate-700">GA4 Measurement ID</div>
                  <div className="h-9 rounded-md border border-slate-200 bg-white px-3 flex items-center text-sm font-mono">
                    {data.ga.measurementId ?? '—'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    Status:{' '}
                    <span
                      className={
                        data.ga.enabled && data.ga.measurementId ? 'font-medium text-emerald-700' : 'font-medium text-slate-600'
                      }
                    >
                      {data.ga.enabled && data.ga.measurementId ? 'Connected' : 'Not connected'}
                    </span>
                    {data.ga.lastEventAt ? (
                      <span className="ml-2 text-slate-500">Last outbound event: {data.ga.lastEventAt}</span>
                    ) : (
                      <span className="ml-2 text-slate-500">No outbound events yet.</span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Read-only in Phase C. Configuration updates will return in a later phase.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">CTR report (last 7 days)</div>
            <div className="p-4 space-y-6">
              <div className="text-xs text-slate-500">Since: {data.ctrReport.since}</div>

              <div>
                <div className="text-sm font-medium text-slate-900">CTR by section</div>
                {data.ctrReport.bySection.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-600">No tracking data yet.</div>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr>
                          <th className="py-2 pr-4">Section</th>
                          <th className="py-2 pr-4">Impressions</th>
                          <th className="py-2 pr-4">Clicks</th>
                          <th className="py-2 pr-4">CTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ctrReport.bySection.map((r) => (
                          <tr key={r.section} className="border-t border-slate-200">
                            <td className="py-2 pr-4 font-mono text-xs">{r.section}</td>
                            <td className="py-2 pr-4 tabular-nums">{r.impressions}</td>
                            <td className="py-2 pr-4 tabular-nums">{r.clicks}</td>
                            <td className="py-2 pr-4 tabular-nums">{(r.ctr * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium text-slate-900">CTR by deal state</div>
                {data.ctrReport.byDealState.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-600">No tracking data yet.</div>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr>
                          <th className="py-2 pr-4">Deal state</th>
                          <th className="py-2 pr-4">Impressions</th>
                          <th className="py-2 pr-4">Clicks</th>
                          <th className="py-2 pr-4">CTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ctrReport.byDealState.map((r) => (
                          <tr key={r.dealStatus} className="border-t border-slate-200">
                            <td className="py-2 pr-4 font-mono text-xs">{r.dealStatus}</td>
                            <td className="py-2 pr-4 tabular-nums">{r.impressions}</td>
                            <td className="py-2 pr-4 tabular-nums">{r.clicks}</td>
                            <td className="py-2 pr-4 tabular-nums">{(r.ctr * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium text-slate-900">Top-performing CTAs</div>
                {data.ctrReport.topCtas.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-600">No click data yet.</div>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr>
                          <th className="py-2 pr-4">CTA variant</th>
                          <th className="py-2 pr-4">Clicks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ctrReport.topCtas.map((r) => (
                          <tr key={r.cta} className="border-t border-slate-200">
                            <td className="py-2 pr-4 font-mono text-xs">{r.cta}</td>
                            <td className="py-2 pr-4 tabular-nums">{r.clicks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

