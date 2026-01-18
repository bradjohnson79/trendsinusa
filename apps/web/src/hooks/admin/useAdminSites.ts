import { useCallback, useEffect, useState } from 'react';

import type { AdminSiteDb } from '@trendsinusa/shared/api';
import { api } from '@/lib/api';

export function useAdminSites() {
  const [sites, setSites] = useState<AdminSiteDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ac = new AbortController();
    try {
      const res = await api.admin.sites.list(ac.signal);
      setSites(res.data.sites);
    } catch (e: unknown) {
      setError(e);
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sites, loading, error, reload };
}

