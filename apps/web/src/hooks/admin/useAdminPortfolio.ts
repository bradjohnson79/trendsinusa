import { useAdminPage } from './useAdminPage';

export type AdminPortfolioSiteRow = { key: string; name?: string; enabled: boolean; domain?: string };

export function useAdminPortfolio() {
  const q = useAdminPage('/portfolio');
  const raw = q.data?.data as unknown;
  const sites =
    raw && typeof raw === 'object' && raw !== null && Array.isArray((raw as any).sites)
      ? ((raw as any).sites as AdminPortfolioSiteRow[])
      : [];
  const partners =
    raw && typeof raw === 'object' && raw !== null && (raw as any).partners && typeof (raw as any).partners === 'object'
      ? ((raw as any).partners as { version: number; partners: unknown[] })
      : { version: 1, partners: [] as unknown[] };
  return { ...q, sites, partners };
}

