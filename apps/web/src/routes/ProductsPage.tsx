import { useEffect, useState } from 'react';

import type { ApiProduct as Product } from '@trendsinusa/shared/api';
import { api, ApiClientError } from '@/lib/api';

export function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api.products
      .list(ac.signal)
      .then((r) => setProducts(r.products))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErr(e instanceof ApiClientError ? e.message : 'Failed to load products');
      });
    return () => ac.abort();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
        <p className="mt-2 text-slate-700">Browse products.</p>
      </div>

      {err ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}

      {!products ? (
        <div className="text-sm text-slate-600">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-sm text-slate-600">No products.</div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {products.map((p) => (
            <li key={p.asin} className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{p.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    asin: <span className="font-mono">{p.asin}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

