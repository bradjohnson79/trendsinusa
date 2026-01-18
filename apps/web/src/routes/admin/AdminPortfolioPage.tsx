import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminPortfolio } from '@/hooks/admin/useAdminPortfolio';

export function AdminPortfolioPage() {
  const q = useAdminPortfolio();
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Portfolio" description="Portfolio overview and status.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}

      {!q.loading && !q.error ? (
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium text-slate-900">Sites</div>
            {q.sites.length ? (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Key</th>
                      <th className="px-3 py-2">Enabled</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Domain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.sites.map((s) => (
                      <tr key={s.key} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-mono text-xs">{s.key}</td>
                        <td className="px-3 py-2">{s.enabled ? 'yes' : 'no'}</td>
                        <td className="px-3 py-2">{s.name ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{s.domain ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2">
                <AdminEmptyState title="No sites" description="No sites were returned by the API." />
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-slate-900">Partners</div>
            {q.partners.partners.length ? (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Raw partner object</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.partners.partners.map((p, idx) => (
                      <tr key={idx} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-mono text-xs whitespace-pre-wrap">{JSON.stringify(p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2">
                <AdminEmptyState title="No partners" description="No partners are configured yet." />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AdminSection>
  );
}

