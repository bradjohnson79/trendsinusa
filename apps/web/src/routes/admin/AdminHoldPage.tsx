import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminPage } from '@/hooks/admin/useAdminPage';

export function AdminHoldPage() {
  const q = useAdminPage('/hold');
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Hold" description="Operational hold controls.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}
      {!q.loading && !q.error ? <AdminEmptyState title="No hold state" description="No hold state was returned." /> : null}
    </AdminSection>
  );
}

