import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminPage } from '@/hooks/admin/useAdminPage';

export function AdminPartnersPage() {
  const q = useAdminPage('/partners');
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Partners" description="Partner management and status.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}
      {!q.loading && !q.error ? <AdminEmptyState title="No partners" description="No partner records were returned." /> : null}
    </AdminSection>
  );
}

