import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminPage } from '@/hooks/admin/useAdminPage';

export function AdminSignalsPage() {
  const q = useAdminPage('/signals');
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Signals" description="Privacy and quality signals overview.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}
      {!q.loading && !q.error ? <AdminEmptyState title="No signals" description="No signal records were returned." /> : null}
    </AdminSection>
  );
}

