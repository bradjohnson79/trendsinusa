import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminRevenue } from '@/hooks/admin/useAdminRevenue';

export function AdminRevenuePage() {
  const q = useAdminRevenue();
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Revenue" description="Revenue intelligence and reporting.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}

      {!q.loading && !q.error && q.data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Affiliate outbound clicks (30d)</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{q.data.affiliateOutboundClicks.total}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Revenue</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{q.data.revenue.available ? 'Available' : 'Unavailable'}</div>
              <div className="mt-1 text-xs text-slate-600">{q.data.revenue.reason ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Window</div>
              <div className="mt-1 font-mono text-xs">{q.data.since}</div>
              <div className="mt-1 font-mono text-xs">{q.data.through}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Affiliate outbound clicks by day</div>
            <div className="p-4">
              {q.data.affiliateOutboundClicks.byDay.length === 0 ? (
                <AdminEmptyState title="No click data" description="No outbound click events were recorded in this window." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Day</th>
                        <th className="py-2 pr-4">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.data.affiliateOutboundClicks.byDay.map((r) => (
                        <tr key={r.day} className="border-t border-slate-200">
                          <td className="py-2 pr-4 font-mono text-xs">{r.day}</td>
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
      ) : null}

      {!q.loading && !q.error && !q.data ? (
        <AdminEmptyState title="No revenue payload" description="No revenue payload was returned by the API." />
      ) : null}
    </AdminSection>
  );
}

