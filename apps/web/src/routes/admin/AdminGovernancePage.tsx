import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminGovernance } from '@/hooks/admin/useAdminGovernance';

export function AdminGovernancePage() {
  const q = useAdminGovernance();
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Governance" description="Governance reports and enforcement controls.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}
      {!q.loading && !q.error ? <AdminEmptyState title="No governance data" description="No governance records were returned." /> : null}
    </AdminSection>
  );
}

