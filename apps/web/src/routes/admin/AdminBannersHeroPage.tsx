import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminBanners } from '@/hooks/admin/useAdminBanners';

export function AdminBannersHeroPage() {
  const q = useAdminBanners();
  const errMsg = useHumanErrorMessage(q.error);
  const activeCount = q.banners.filter((b) => b.enabled).length;

  return (
    <AdminSection title="Banners & Hero" description="Manage hero imagery and banner settings.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}

      {!q.loading && !q.error && q.siteKey ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Site</div>
              <div className="mt-1 font-mono text-xs">{q.siteKey}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Hero image</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{q.hero?.imageUrl ? 'Configured' : 'Not set'}</div>
              <div className="mt-1 font-mono text-[11px] text-slate-600">{q.hero?.updatedAt ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Active banners</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{activeCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Total banners</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{q.banners.length}</div>
            </div>
          </div>

          {q.banners.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Placement</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Enabled</th>
                    <th className="px-3 py-2">Href</th>
                  </tr>
                </thead>
                <tbody>
                  {q.banners.map((b) => (
                    <tr key={b.id} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-mono text-xs">{b.placement}</td>
                      <td className="px-3 py-2">{b.title}</td>
                      <td className="px-3 py-2">{b.enabled ? 'yes' : 'no'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{b.href ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminEmptyState title="No banners yet" description="Create banners in the backend; they’ll appear here immediately." />
          )}
        </div>
      ) : null}

      {!q.loading && !q.error && !q.siteKey ? (
        <AdminEmptyState title="No banners payload" description="No banner configuration was returned." />
      ) : null}
    </AdminSection>
  );
}

