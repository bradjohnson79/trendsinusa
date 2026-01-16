'use client';

import { useMemo, useState, useTransition } from 'react';

import type { AdminProductRow } from '@/src/server/admin/products';
import { relativeTimeFrom } from '@/src/lib/format';
import { setProductBlocked, setProductCategoryOverride, setProductCoreTags, setProductSiteEligibility } from './actions';

type DetailResponse =
  | { ok: false }
  | {
      ok: true;
      product: {
        asin: string;
        title: string;
        imageUrl: string | null;
        productUrl: string | null;
        category: string | null;
        categoryOverride: string | null;
        source: string;
        externalId: string | null;
        rating: number | null;
        reviewCount: number | null;
        blocked: boolean;
        tags: string[];
        createdAt: string;
        updatedAt: string;
      };
      deals: Array<{
        id: string;
        status: string;
        suppressed: boolean;
        expiresAt: string;
        discountPercent: number | null;
        currentPriceCents: number;
        oldPriceCents: number | null;
        currency: string;
        updatedAt: string;
      }>;
      activeDealsCount: number;
      audit: Array<{ createdAt: string; message: string }>;
    };

function Badge(props: { tone: 'slate' | 'green' | 'amber' | 'red' | 'blue'; children: string }) {
  const cls =
    props.tone === 'green'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : props.tone === 'amber'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : props.tone === 'red'
          ? 'bg-rose-50 text-rose-800 border-rose-200'
          : props.tone === 'blue'
            ? 'bg-sky-50 text-sky-800 border-sky-200'
            : 'bg-slate-50 text-slate-700 border-slate-200';
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${cls}`}>{props.children}</span>;
}

function coreTagTone(t: string): 'slate' | 'blue' | 'amber' {
  // (tone types are intentionally conservative; evergreen uses slate-like styling here)
  if (t === 'evergreen') return 'slate';
  if (t === 'seasonal') return 'amber';
  if (t === 'impulse') return 'blue';
  return 'slate';
}

export function ProductsTable(props: { products: AdminProductRow[]; sites: Array<{ key: string; enabled: boolean }> }) {
  const [pending, startTransition] = useTransition();
  const [openAsin, setOpenAsin] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const enabledSites = useMemo(() => props.sites.filter((s) => s.enabled).map((s) => s.key), [props.sites]);

  async function openDetail(asin: string) {
    setOpenAsin(asin);
    setLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/admin/products/${encodeURIComponent(asin)}/detail`, { cache: 'no-store' });
      setDetail((await res.json()) as DetailResponse);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2">Active deals</th>
              <th className="px-3 py-2">Sites</th>
              <th className="px-3 py-2">Ingestion</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {props.products.map((p) => (
              <tr key={p.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-2">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-[280px]">
                      <div className="font-medium text-slate-900">{p.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        <span className="font-mono">{p.asin}</span> · <span className="font-mono">{p.source}</span>
                      </div>
                      {p.blocked ? <div className="mt-1"><Badge tone="slate">suppressed</Badge></div> : null}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-sm text-slate-900">{p.derived.effectiveCategory ?? '—'}</div>
                  {p.derived.hasOverride ? <div className="mt-1"><Badge tone="blue">override</Badge></div> : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {p.derived.coreTags.length ? (
                      p.derived.coreTags.map((t) => (
                        <Badge key={`${p.id}:${t}`} tone={coreTagTone(t)}>
                          {t}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums">{p.derived.activeDealCount}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(p.derived.visibilitySites.length ? p.derived.visibilitySites : ['—']).map((s) => (
                      <Badge key={`${p.id}:${s}`} tone="slate">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-xs text-slate-700">
                    first seen: <span className="font-mono">{p.createdAt.toISOString()}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-700">
                    last refreshed: <span className="font-mono">{p.updatedAt.toISOString()}</span> <span className="text-slate-500">({relativeTimeFrom(p.updatedAt)})</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-2">
                    <button
                      className="text-left text-xs text-sky-700 underline disabled:opacity-50"
                      disabled={pending}
                      onClick={() => void openDetail(p.asin)}
                    >
                      View details →
                    </button>
                    <button
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50"
                      disabled={pending}
                      onClick={() => {
                        const action = p.blocked ? 'Unsuppress' : 'Suppress';
                        const reason = window.prompt(`${action} product. Reason (required for audit):`, '') ?? '';
                        if (!reason.trim()) return;
                        if (!window.confirm(`${action} this product? This affects eligibility only.`)) return;
                        startTransition(() => setProductBlocked({ asin: p.asin, blocked: !p.blocked, reason }));
                      }}
                    >
                      {p.blocked ? 'Unsuppress' : 'Suppress'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openAsin && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/30 p-4" onClick={() => setOpenAsin(null)}>
          <div className="h-full w-full max-w-xl overflow-auto rounded-lg bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Product details</div>
                <div className="mt-1 text-xs text-slate-500 font-mono">{openAsin}</div>
              </div>
              <button className="rounded-md border border-slate-200 px-2 py-1 text-xs" onClick={() => setOpenAsin(null)}>
                Close
              </button>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-slate-600">Loading…</div>
            ) : !detail || detail.ok === false ? (
              <div className="mt-4 text-sm text-slate-600">Not found.</div>
            ) : (
              <div className="mt-4 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-start gap-3">
                      <div className="h-20 w-20 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {detail.product.imageUrl ? <img src={detail.product.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{detail.product.title}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          ASIN: <span className="font-mono">{detail.product.asin}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          Source: <span className="font-mono">{detail.product.source}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          Reviews: {detail.product.rating ?? '—'} ({detail.product.reviewCount ?? 0})
                        </div>
                        {detail.product.productUrl ? (
                          <div className="mt-2 text-xs">
                            <a className="text-sky-700 underline" href={detail.product.productUrl} target="_blank" rel="noreferrer">
                              Open product URL →
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">Category override</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Auto: <span className="font-mono">{detail.product.category ?? '—'}</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        id="categoryOverride"
                        defaultValue={detail.product.categoryOverride ?? ''}
                        placeholder="Override category (optional)"
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                      />
                      <button
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm disabled:opacity-50"
                        disabled={pending}
                        onClick={() => {
                          const el = document.getElementById('categoryOverride') as HTMLInputElement | null;
                          const value = el?.value ?? '';
                          const reason = window.prompt('Reason for category override change (required):', '') ?? '';
                          if (!reason.trim()) return;
                          startTransition(async () => {
                            await setProductCategoryOverride({ asin: detail.product.asin, categoryOverride: value.trim() || null, reason });
                            await openDetail(detail.product.asin);
                          });
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm disabled:opacity-50"
                        disabled={pending}
                        onClick={() => {
                          const reason = window.prompt('Reason for clearing override (required):', '') ?? '';
                          if (!reason.trim()) return;
                          startTransition(async () => {
                            await setProductCategoryOverride({ asin: detail.product.asin, categoryOverride: null, reason });
                            await openDetail(detail.product.asin);
                          });
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">Tags</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {(['evergreen', 'seasonal', 'impulse'] as const).map((t) => {
                        const checked = detail.product.tags.includes(t);
                        return (
                          <label key={t} className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked={checked} id={`tag_${t}`} />
                            <span className="text-sm">{t}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3">
                      <button
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                        disabled={pending}
                        onClick={() => {
                          const reason = window.prompt('Reason for tag change (required):', '') ?? '';
                          if (!reason.trim()) return;
                          const tags: Array<'evergreen' | 'seasonal' | 'impulse'> = [];
                          for (const t of ['evergreen', 'seasonal', 'impulse'] as const) {
                            const el = document.getElementById(`tag_${t}`) as HTMLInputElement | null;
                            if (el?.checked) tags.push(t);
                          }
                          startTransition(async () => {
                            await setProductCoreTags({ asin: detail.product.asin, tags, reason });
                            await openDetail(detail.product.asin);
                          });
                        }}
                      >
                        Save tags
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">Site eligibility</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {enabledSites.map((k) => {
                        const checked = detail.product.tags.includes(`site:${k}`);
                        return (
                          <label key={k} className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked={checked} id={`site_${k}`} />
                            <span className="font-mono text-xs">{k}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3">
                      <button
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                        disabled={pending}
                        onClick={() => {
                          const reason = window.prompt('Reason for site eligibility change (required):', '') ?? '';
                          if (!reason.trim()) return;
                          const siteKeys: string[] = [];
                          for (const k of enabledSites) {
                            const el = document.getElementById(`site_${k}`) as HTMLInputElement | null;
                            if (el?.checked) siteKeys.push(k);
                          }
                          startTransition(async () => {
                            await setProductSiteEligibility({ asin: detail.product.asin, siteKeys, reason });
                            await openDetail(detail.product.asin);
                          });
                        }}
                      >
                        Save sites
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">Linked deals</div>
                    <div className="mt-2 text-xs text-slate-600">Active deals: {detail.activeDealsCount}</div>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs text-slate-500">
                          <tr>
                            <th className="py-1 pr-3">Deal</th>
                            <th className="py-1 pr-3">Status</th>
                            <th className="py-1 pr-3">Expiry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.deals.map((d) => (
                            <tr key={d.id} className="border-t border-slate-200">
                              <td className="py-1 pr-3 font-mono text-xs">{d.id}</td>
                              <td className="py-1 pr-3 font-mono text-xs">
                                {d.suppressed ? 'paused' : d.status}
                              </td>
                              <td className="py-1 pr-3 font-mono text-xs">{d.expiresAt}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">Audit trail (latest)</div>
                    {detail.audit.length === 0 ? (
                      <div className="mt-2 text-sm text-slate-600">No overrides logged yet.</div>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {detail.audit.map((a) => (
                          <li key={a.createdAt + a.message} className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                            <div className="text-slate-500 font-mono">{a.createdAt}</div>
                            <div className="mt-1 font-mono break-words">{a.message}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">AI notes</div>
                    <div className="mt-1 text-sm text-slate-600">Read-only placeholder. Product AI notes are not stored yet.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

