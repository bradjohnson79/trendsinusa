import { useAdminPage } from './useAdminPage';

export function useAdminSeoPromotion() {
  // Phase B: new canonical endpoint
  const q = useAdminPage('/seo/dashboard');
  const raw = q.data?.data as unknown;

  const dashboard =
    raw && typeof raw === 'object' && raw !== null
      ? ({
          siteKey: typeof (raw as any).siteKey === 'string' ? String((raw as any).siteKey) : null,
          indexedPages: typeof (raw as any).indexedPages === 'number' ? Number((raw as any).indexedPages) : null,
          lastSitemapAt: (raw as any).lastSitemapAt == null ? null : String((raw as any).lastSitemapAt),
          lastIndexPingAt: (raw as any).lastIndexPingAt == null ? null : String((raw as any).lastIndexPingAt),
          issues: Array.isArray((raw as any).issues) ? ((raw as any).issues as Array<{ id: string; type: string; message: string }>) : [],
        } as const)
      : null;

  return { ...q, dashboard };
}

