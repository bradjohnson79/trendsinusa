import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminMonetization } from '@/hooks/admin/useAdminMonetization';

export function AdminMonetizationPage() {
  const q = useAdminMonetization();
  const errMsg = useHumanErrorMessage(q.error);

  return (
    <AdminSection title="Monetization" description="Partner monetization configuration and reporting.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}
      {!q.loading && !q.error ? <AdminEmptyState title="No monetization data" description="No monetization records were returned." /> : null}
    </AdminSection>
  );
}

