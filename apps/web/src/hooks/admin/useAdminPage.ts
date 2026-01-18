import { useCallback, useEffect, useState } from 'react';

import type { AdminPageResponse } from '@trendsinusa/shared/api';
import { api } from '@/lib/api';

export function useAdminPage(path: string) {
  const [data, setData] = useState<AdminPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.admin.pages.get(path));
    } catch (e: unknown) {
      setError(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

