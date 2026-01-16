import { getCtrReport } from '@/src/server/admin/ctr';
import { readSitesConfig } from '@trendsinusa/shared';
import { getGaConfigForSite } from '@/src/server/analytics/config';
import { saveGa4Config } from './actions';
import { getCurrentSiteKey } from '@/src/server/site';

export default async function AdminAnalyticsPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const report = await getCtrReport({ days: 7 });
  const sp = (await props.searchParams) ?? {};
  const selectedSite = typeof sp.site === 'string' ? sp.site : getCurrentSiteKey();
  const [{ config }, ga] = await Promise.all([readSitesConfig(), getGaConfigForSite(selectedSite)]);
  const sites = config.sites.map((s) => ({ key: s.key, name: s.name, enabled: s.enabled }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lean, useful metrics for Phase 1. Signal without noise.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Google Analytics (GA4)</div>
        <div className="p-4 space-y-4">
          <form action="" method="get" className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1">
              <div className="text-xs font-medium text-slate-700">Site</div>
              <select
                name="site"
                defaultValue={selectedSite}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {sites.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.key} — {s.name}{s.enabled ? '' : ' (disabled)'}
                  </option>
                ))}
              </select>
            </label>
            <button className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800">
              Switch
            </button>
          </form>

          <form action={saveGa4Config} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
            <input type="hidden" name="siteKey" value={selectedSite} />
            <div className="grid gap-1">
              <div className="text-xs font-medium text-slate-700">GA4 Measurement ID</div>
              <input
                name="gaMeasurementId"
                defaultValue={ga.measurementId ?? ''}
                placeholder="G-XXXXXXXXXX"
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-mono"
              />
              <div className="text-xs text-slate-500">Stored per-site in the database. Script injects only when enabled.</div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={ga.enabled} />
              Enable GA tracking for this site
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Status:{' '}
                <span className={ga.enabled && ga.measurementId ? 'font-medium text-emerald-700' : 'font-medium text-slate-600'}>
                  {ga.enabled && ga.measurementId ? 'Connected' : 'Not connected'}
                </span>
                {ga.lastEventAt ? (
                  <span className="ml-2 text-slate-500">Last outbound event: {ga.lastEventAt.toISOString()}</span>
                ) : (
                  <span className="ml-2 text-slate-500">No outbound events yet.</span>
                )}
              </div>
              <button className="h-9 rounded-md bg-white px-3 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
                Save
              </button>
            </div>

            <div className="text-xs text-slate-500">
              GA is observational only. Internal analytics remain authoritative. We do not send internal AI metrics to GA.
            </div>
          </form>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          CTR report (last 7 days)
        </div>
        <div className="p-4 space-y-6">
          <div className="text-xs text-slate-500">Since: {report.since.toISOString()}</div>

          <div>
            <div className="text-sm font-medium text-slate-900">CTR by section</div>
            {report.bySection.length === 0 ? (
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
                    {report.bySection.map((r) => (
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
            {report.byDealState.length === 0 ? (
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
                    {report.byDealState.map((r) => (
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
            {report.topCtas.length === 0 ? (
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
                    {report.topCtas.map((r) => (
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
    </div>
  );
}

