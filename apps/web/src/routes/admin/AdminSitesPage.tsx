import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminSites } from '@/hooks/admin/useAdminSites';
import { ApiClientError, api } from '@/lib/api';

export function AdminSitesPage() {
  const q = useAdminSites();
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Sites" description="Multi-site control panel. Configure enabled sites and basic metadata.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}

      {!q.loading && !q.error ? (
        q.sites.length ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Enabled</th>
                    <th className="px-3 py-2">Domain</th>
                    <th className="px-3 py-2">Currency</th>
                    <th className="px-3 py-2">Affiliate tag</th>
                    <th className="px-3 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {q.sites.map((s) => (
                    <tr key={s.id} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          onChange={async (e) => {
                            try {
                              await api.admin.sites.update(s.id, { enabled: e.target.checked });
                              await q.reload();
                            } catch (ex: unknown) {
                              // keep UX minimal; surface via alert for now (no new styling system)
                              // eslint-disable-next-line no-alert
                              alert(ex instanceof ApiClientError ? ex.message : 'Failed to update site');
                            }
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{s.domain}</td>
                      <td className="px-3 py-2 font-mono text-xs">{s.currency}</td>
                      <td className="px-3 py-2 font-mono text-xs">{s.affiliateTag}</td>
                      <td className="px-3 py-2 font-mono text-xs">{s.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium text-slate-900">Create site</div>
              <form
                className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const code = String(fd.get('code') ?? '').trim().toUpperCase();
                  const domain = String(fd.get('domain') ?? '').trim();
                  const currency = String(fd.get('currency') ?? '').trim().toUpperCase();
                  const affiliateTag = String(fd.get('affiliateTag') ?? '').trim();
                  const enabled = fd.get('enabled') === 'on';
                  try {
                    await api.admin.sites.create({ code, domain, currency, affiliateTag, enabled });
                    e.currentTarget.reset();
                    await q.reload();
                  } catch (ex: unknown) {
                    // eslint-disable-next-line no-alert
                    alert(ex instanceof ApiClientError ? ex.message : 'Failed to create site');
                  }
                }}
              >
                <label className="text-xs text-slate-600 md:col-span-1">
                  Code
                  <input name="code" placeholder="US" className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" />
                </label>
                <label className="text-xs text-slate-600 md:col-span-2">
                  Domain
                  <input
                    name="domain"
                    placeholder="example.com"
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-600 md:col-span-1">
                  Currency
                  <input name="currency" placeholder="USD" className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" />
                </label>
                <label className="text-xs text-slate-600 md:col-span-2">
                  Affiliate tag
                  <input
                    name="affiliateTag"
                    placeholder="yourtag-20"
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 md:col-span-6">
                  <input type="checkbox" name="enabled" defaultChecked />
                  Enabled
                </label>
                <div className="md:col-span-6">
                  <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">Create</button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <AdminEmptyState title="No sites found" description="No sites have been returned by the API." />
        )
      ) : null}
    </AdminSection>
  );
}

