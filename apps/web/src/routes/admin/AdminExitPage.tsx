import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminPage } from '@/hooks/admin/useAdminPage';

export function AdminExitPage() {
  const q = useAdminPage('/exit');
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Exit" description="Exit readiness and reporting.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}
      {!q.loading && !q.error ? <AdminEmptyState title="No exit report" description="No exit report data was returned." /> : null}
    </AdminSection>
  );
}

