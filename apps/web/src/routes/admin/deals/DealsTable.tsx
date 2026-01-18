'use client';

import { useMemo, useState, useTransition } from 'react';

import type { AdminDealMetrics, AdminDealRow } from '@trendsinusa/shared/api';
import { api } from '@/lib/api';
import { formatMoney, relativeTimeFrom } from '@/lib/format';

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

function toneForState(s: AdminDealRow['derived']['dealStateLabel']): 'green' | 'amber' | 'red' | 'slate' | 'blue' {
  if (s === 'paused') return 'slate';
  if (s === 'expired') return 'red';
  if (s === 'expiring') return 'amber';
  if (s === 'scheduled') return 'blue';
  return 'green';
}

function Countdown(props: { expiresAt: string }) {
  const d = new Date(props.expiresAt);
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return <span className="text-xs text-slate-500">Expired</span>;
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs >= 1) return (
    <span className="text-xs tabular-nums">
      {hrs}h {mins % 60}m
    </span>
  );
  return <span className="text-xs tabular-nums">{mins}m</span>;
}

function confirmBulk(action: string, n: number): boolean {
  return window.confirm(`Confirm ${action} for ${n} selected deal(s)?`);
}

export function DealsTable(props: { deals: AdminDealRow[]; onMutateDone?: () => Promise<void> | void }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminDealMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  async function openMetrics(dealId: string) {
    setOpenId(dealId);
    setMetrics(null);
    setMetricsLoading(true);
    try {
      setMetrics(await api.admin.deals.metrics(dealId));
    } finally {
      setMetricsLoading(false);
    }
  }

  function runBulk(kind: 'feature' | 'pause' | 'resume' | 'force_expire' | 'reevaluate') {
    if (!selectedIds.length) return;
    if (!confirmBulk(kind.replace('_', ' '), selectedIds.length)) return;
    startTransition(async () => {
      setActionErr(null);
      try {
        if (kind === 'feature') await api.admin.deals.feature(selectedIds);
        if (kind === 'pause') await api.admin.deals.pause(selectedIds);
        if (kind === 'resume') await api.admin.deals.resume(selectedIds);
        if (kind === 'force_expire') await api.admin.deals.forceExpire(selectedIds);
        if (kind === 'reevaluate') await api.admin.deals.reevaluate(selectedIds);
        setSelected({});
        await props.onMutateDone?.();
      } catch (e: unknown) {
        setActionErr(e instanceof Error ? e.message : 'Action failed');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={pending || selectedIds.length === 0}
          onClick={() => runBulk('feature')}
        >
          Feature
        </button>
        <button
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={pending || selectedIds.length === 0}
          onClick={() => runBulk('pause')}
        >
          Pause
        </button>
        <button
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={pending || selectedIds.length === 0}
          onClick={() => runBulk('resume')}
        >
          Resume
        </button>
        <button
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-900 disabled:opacity-50"
          disabled={pending || selectedIds.length === 0}
          onClick={() => runBulk('force_expire')}
        >
          Force expire
        </button>
        <button
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={pending || selectedIds.length === 0}
          onClick={() => runBulk('reevaluate')}
        >
          Re-evaluate
        </button>
        <div className="ml-auto text-xs text-slate-500">{selectedIds.length} selected</div>
      </div>

      {actionErr ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{actionErr}</div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={props.deals.length > 0 && selectedIds.length === props.deals.length}
                  onChange={(e) => {
                    const next: Record<string, boolean> = {};
                    if (e.target.checked) for (const d of props.deals) next[d.id] = true;
                    setSelected(next);
                  }}
                />
              </th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Discount</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Sites</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {props.deals.map((d) => {
              const state = d.derived.dealStateLabel;
              const tone = toneForState(state);
              const price = formatMoney(d.currentPriceCents, d.currency);
              const old = d.oldPriceCents != null ? formatMoney(d.oldPriceCents, d.currency) : null;
              const exp = new Date(d.expiresAt);
              const expIso = exp.toISOString();
              const sites = d.derived.visibleSites.length ? d.derived.visibleSites : ['—'];
              return (
                <tr key={d.id} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selected[d.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [d.id]: e.target.checked }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {d.product.imageUrl ? <img src={d.product.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-[260px]">
                        <div className="font-medium text-slate-900">{d.product.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          <span className="font-mono">{d.product.asin}</span> · <span className="font-mono">{d.source}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{d.product.categoryOverride ?? d.product.category ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{d.discountPercent != null ? `${d.discountPercent}%` : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="tabular-nums font-medium">{price}</div>
                    <div className="text-xs text-slate-500 line-through">{old ?? ''}</div>
                    <div className="text-xs text-slate-500">read-only</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs">{expIso}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Countdown expiresAt={expIso} />
                      <span className="text-xs text-slate-500">({relativeTimeFrom(exp)})</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={tone}>{state}</Badge>
                    {d.derived.scheduledPlacementTypes.length ? (
                      <div className="mt-1 text-xs text-slate-500">scheduled: {d.derived.scheduledPlacementTypes.join(', ')}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {sites.map((s) => (
                        <Badge key={`${d.id}:${s}`} tone="slate">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={d.derived.priority === 'featured' ? 'blue' : 'slate'}>{d.derived.priority}</Badge>
                    {d.derived.activePlacementTypes.length ? (
                      <div className="mt-1 text-xs text-slate-500">active: {d.derived.activePlacementTypes.join(', ')}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm('Feature this deal?')) return;
                            startTransition(async () => {
                              setActionErr(null);
                              try {
                                await api.admin.deals.feature([d.id]);
                                await props.onMutateDone?.();
                              } catch (e: unknown) {
                                setActionErr(e instanceof Error ? e.message : 'Action failed');
                              }
                            });
                          }}
                        >
                          Feature
                        </button>
                        <button
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50"
                          disabled={pending}
                          onClick={() => {
                            const action = d.suppressed ? 'Resume' : 'Pause';
                            if (!window.confirm(`${action} this deal?`)) return;
                            startTransition(async () => {
                              setActionErr(null);
                              try {
                                if (d.suppressed) await api.admin.deals.resume([d.id]);
                                else await api.admin.deals.pause([d.id]);
                                await props.onMutateDone?.();
                              } catch (e: unknown) {
                                setActionErr(e instanceof Error ? e.message : 'Action failed');
                              }
                            });
                          }}
                        >
                          {d.suppressed ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-900 disabled:opacity-50"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm('Force expire this deal? This is destructive.')) return;
                            startTransition(async () => {
                              setActionErr(null);
                              try {
                                await api.admin.deals.forceExpire([d.id]);
                                await props.onMutateDone?.();
                              } catch (e: unknown) {
                                setActionErr(e instanceof Error ? e.message : 'Action failed');
                              }
                            });
                          }}
                        >
                          Force expire
                        </button>
                        <button
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm('Re-evaluate deal state from expiresAt?')) return;
                            startTransition(async () => {
                              setActionErr(null);
                              try {
                                await api.admin.deals.reevaluate([d.id]);
                                await props.onMutateDone?.();
                              } catch (e: unknown) {
                                setActionErr(e instanceof Error ? e.message : 'Action failed');
                              }
                            });
                          }}
                        >
                          Re-evaluate
                        </button>
                      </div>
                      <button className="text-left text-xs text-sky-700 underline disabled:opacity-50" disabled={pending} onClick={() => void openMetrics(d.id)}>
                        View details →
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openId && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/30 p-4" onClick={() => setOpenId(null)}>
          <div className="h-full w-full max-w-xl overflow-auto rounded-lg bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Deal details</div>
                <div className="mt-1 text-xs text-slate-500 font-mono">{openId}</div>
              </div>
              <button className="rounded-md border border-slate-200 px-2 py-1 text-xs" onClick={() => setOpenId(null)}>
                Close
              </button>
            </div>

            {metricsLoading ? (
              <div className="mt-4 text-sm text-slate-600">Loading…</div>
            ) : metrics ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Impressions (30d)</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{metrics.impressions}</div>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Clicks (30d)</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{metrics.clicks}</div>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">CTR</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{(metrics.ctr * 100).toFixed(2)}%</div>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-sm font-medium text-slate-900">Performance by site</div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr>
                          <th className="py-1 pr-3">Site</th>
                          <th className="py-1 pr-3">Imps</th>
                          <th className="py-1 pr-3">Clicks</th>
                          <th className="py-1 pr-3">CTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.bySite.map((r) => (
                          <tr key={r.site} className="border-t border-slate-200">
                            <td className="py-1 pr-3 font-mono text-xs">{r.site}</td>
                            <td className="py-1 pr-3 tabular-nums">{r.impressions}</td>
                            <td className="py-1 pr-3 tabular-nums">{r.clicks}</td>
                            <td className="py-1 pr-3 tabular-nums">{(r.ctr * 100).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-sm font-medium text-slate-900">AI notes</div>
                  <div className="mt-1 text-sm text-slate-600">{metrics.aiNotes.note}</div>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-600">No metrics.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

