import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminSeoPromotion } from '@/hooks/admin/useAdminSeoPromotion';

export function AdminSeoPromotionPage() {
  const q = useAdminSeoPromotion();
  const errMsg = useHumanErrorMessage(q.error);
  const d = q.dashboard;

  return (
    <AdminSection title="SEO & Promotion" description="SEO operations, indexing, and promotional controls.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}

      {!q.loading && !q.error && d ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Site</div>
              <div className="mt-1 font-mono text-xs">{d.siteKey ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Indexed pages</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{d.indexedPages ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Last sitemap generated</div>
              <div className="mt-1 font-mono text-xs">{d.lastSitemapAt ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Last index ping</div>
              <div className="mt-1 font-mono text-xs">{d.lastIndexPingAt ?? '—'}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Issues</div>
            <div className="p-4">
              {d.issues.length === 0 ? (
                <div className="text-sm text-slate-600">No issues detected.</div>
              ) : (
                <ul className="space-y-2">
                  {d.issues.map((it) => (
                    <li key={it.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                      <div className="font-medium">{it.type}</div>
                      <div className="text-slate-600">{it.message}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!q.loading && !q.error && !d ? <AdminEmptyState title="SEO dashboard unavailable" description="No SEO dashboard payload was returned." /> : null}
    </AdminSection>
  );
}

