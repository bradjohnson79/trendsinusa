import { useAdminPage } from './useAdminPage';

export type AdminBanner = { id: string; placement: string; title: string; imageUrl: string | null; href: string | null; enabled: boolean };
export type AdminHeroConfig = { imageUrl: string | null; updatedAt: string | null };

export function useAdminBanners() {
  const q = useAdminPage('/banners');
  const raw = q.data?.data as unknown;
  const siteKey =
    raw && typeof raw === 'object' && raw !== null && typeof (raw as any).siteKey === 'string' ? String((raw as any).siteKey) : null;
  const hero = raw && typeof raw === 'object' && raw !== null ? (((raw as any).hero ?? null) as AdminHeroConfig | null) : null;
  const banners =
    raw && typeof raw === 'object' && raw !== null && Array.isArray((raw as any).banners) ? ((raw as any).banners as AdminBanner[]) : [];

  return { ...q, siteKey, hero, banners };
}

