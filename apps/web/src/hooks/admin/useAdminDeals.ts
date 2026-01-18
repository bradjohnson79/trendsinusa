import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AdminDealsListResponse, AdminDealRow } from '@trendsinusa/shared/api';
import { api, ApiClientError } from '@/lib/api';

export type AdminDealsQuery = {
  status?: string;
  window?: string;
  site?: string;
  category?: string;
  source?: string;
  q?: string;
};

export function useAdminDeals(query: AdminDealsQuery) {
  const q = useMemo(
    () => ({
      status: query.status,
      window: query.window,
      site: query.site,
      category: query.category,
      source: query.source,
      q: query.q,
    }),
    [query.category, query.q, query.site, query.source, query.status, query.window],
  );

  const [data, setData] = useState<AdminDealsListResponse | null>(null);
  const [deals, setDeals] = useState<AdminDealRow[] | null>(null);
  const [sites, setSites] = useState<Array<{ key: string; enabled: boolean }>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  function buildParams(cursor: string | null) {
    const params: {
      limit: number;
      cursor: string | null;
      status?: string;
      window?: string;
      site?: string;
      category?: string;
      source?: string;
      q?: string;
    } = { limit: 50, cursor };

    if (q.status) params.status = q.status;
    if (q.window) params.window = q.window;
    if (q.site) params.site = q.site;
    if (q.category) params.category = q.category;
    if (q.source) params.source = q.source;
    if (q.q) params.q = q.q;

    return params;
  }

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDeals(null);
    try {
      const res = await api.admin.deals.list(buildParams(null));
      setData(res);
      setDeals(res.deals);
      setSites(res.sites);
      setNextCursor(res.nextCursor);
    } catch (e: unknown) {
      setError(e);
      setData(null);
      setDeals([]);
      setSites([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || !deals) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await api.admin.deals.list(buildParams(nextCursor));
      setDeals([...deals, ...res.deals]);
      setNextCursor(res.nextCursor);
    } catch (e: unknown) {
      setError(e);
    } finally {
      setLoadingMore(false);
    }
  }, [deals, nextCursor, q]);

  const errorMessage =
    error instanceof ApiClientError ? error.message : error ? 'Failed to load deals' : null;

  return {
    data,
    deals,
    sites,
    nextCursor,
    loading,
    loadingMore,
    error,
    errorMessage,
    reload: loadFirstPage,
    loadMore,
  };
}

