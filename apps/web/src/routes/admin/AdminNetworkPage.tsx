import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminNetwork } from '@/hooks/admin/useAdminNetwork';

export function AdminNetworkPage() {
  const q = useAdminNetwork();
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Network" description="Network health and loop checks.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}
      {!q.loading && !q.error ? <AdminEmptyState title="No network data" description="No network metrics were returned." /> : null}
    </AdminSection>
  );
}

