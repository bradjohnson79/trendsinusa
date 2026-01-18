import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminPage } from '@/hooks/admin/useAdminPage';

export function AdminDependenciesPage() {
  const q = useAdminPage('/dependencies');
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Dependencies" description="Dependency health overview and checks.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}
      {!q.loading && !q.error ? <AdminEmptyState title="No dependency report" description="No dependency report was returned." /> : null}
    </AdminSection>
  );
}

