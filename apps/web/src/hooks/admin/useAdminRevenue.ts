import { useAdminPage } from './useAdminPage';

export type AdminRevenueData = {
  since: string;
  through: string;
  affiliateOutboundClicks: { total: number; byDay: Array<{ day: string; clicks: number }> };
  revenue: { available: boolean; reason?: string };
};

export function useAdminRevenue() {
  const q = useAdminPage('/revenue');
  const raw = q.data?.data as unknown;
  const data =
    raw && typeof raw === 'object' && raw !== null
      ? (raw as AdminRevenueData)
      : null;
  return { ...q, data };
}

