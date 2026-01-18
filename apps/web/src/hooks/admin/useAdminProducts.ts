import { useAdminPage } from './useAdminPage';

export type AdminProductRow = { asin: string; title: string; source?: string; updatedAt?: string };

export function useAdminProducts() {
  const q = useAdminPage('/products');
  const raw = q.data?.data as unknown;
  const products =
    raw && typeof raw === 'object' && raw !== null && Array.isArray((raw as any).products)
      ? ((raw as any).products as AdminProductRow[])
      : [];
  return { ...q, products };
}

