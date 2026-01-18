import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminProducts } from '@/hooks/admin/useAdminProducts';

export function AdminProductsPage() {
  const q = useAdminProducts();
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Products" description="Review and manage ingested products.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}

      {!q.loading && !q.error ? (
        q.products.length ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">ASIN</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {q.products.map((p) => (
                  <tr key={p.asin} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-mono text-xs">{p.asin}</td>
                    <td className="px-3 py-2">{p.title}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.source ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.updatedAt ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState title="No products yet" description="No products have been returned by the API." />
        )
      ) : null}
    </AdminSection>
  );
}

