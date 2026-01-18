import { useEffect, useState } from 'react';

import type { ApiDeal as Deal } from '@trendsinusa/shared/api';
import { api, ApiClientError } from '@/lib/api';

export function DealsPage() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api.deals
      .list(ac.signal)
      .then((r) => setDeals(r.deals))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErr(e instanceof ApiClientError ? e.message : 'Failed to load deals');
      });
    return () => ac.abort();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Deals</h1>
        <p className="mt-2 text-slate-700">Browse current deals.</p>
      </div>

      {err ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}

      {!deals ? (
        <div className="text-sm text-slate-600">Loading…</div>
      ) : deals.length === 0 ? (
        <div className="text-sm text-slate-600">No deals.</div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {deals.map((d) => (
            <li key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{d.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    id: <span className="font-mono">{d.id}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">status</div>
                  <div className="mt-1 font-mono text-xs">{d.status}</div>
                  <div className="mt-2 text-xs text-slate-500">expires</div>
                  <div className="mt-1 font-mono text-xs">{d.expiresAt}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

