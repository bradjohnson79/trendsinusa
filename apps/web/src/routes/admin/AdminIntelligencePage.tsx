import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminPage } from '@/hooks/admin/useAdminPage';

export function AdminIntelligencePage() {
  const q = useAdminPage('/intelligence');
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Intelligence" description="Network intelligence reports and summaries.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}
      {!q.loading && !q.error ? <AdminEmptyState title="No intelligence data" description="No intelligence records were returned." /> : null}
    </AdminSection>
  );
}

