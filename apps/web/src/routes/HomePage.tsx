import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import type { DiscoveryCandidatePublic, DiscoveryResponse, UnaffiliatedPostsResponse } from '@trendsinusa/shared/api';
import { EmptyState } from '@/components/public/EmptyState';
import { Footer } from '@/components/public/Footer';
import { Logo } from '@/components/public/Logo';
import { ProductImage } from '@/components/public/ProductImage';
import { api, ApiClientError } from '@/lib/api';
import { countdownFromIso, relativeTimeFrom } from '@/lib/format';
import { siteConfig } from '@/sites/config';

function hoursAgo(nowIso: string, thenIso: string): number {
  const now = new Date(nowIso).getTime();
  const then = new Date(thenIso).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now - then) / (60 * 60 * 1000)));
}

function retailerLabel(r: DiscoveryCandidatePublic['retailer']) {
  if (r === 'BEST_BUY') return 'Best Buy';
  return r.charAt(0) + r.slice(1).toLowerCase();
}

function isDead(linkStatus: any) {
  return String(linkStatus ?? '').toUpperCase() === 'DEAD';
}

export function HomePage() {
  const name = siteConfig.branding.name;

  // Stable clock for countdowns/badges (updates once per second).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [discoveryErr, setDiscoveryErr] = useState<string | null>(null);
  const [posts, setPosts] = useState<UnaffiliatedPostsResponse | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api.discovery
      .list(ac.signal, { limit: 60 })
      .then((r) => setDiscovery(r))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setDiscoveryErr(e instanceof ApiClientError ? e.message : 'Failed to load discovery feed');
      });
    api.posts
      .list(ac.signal, { limit: 6 })
      .then((r) => setPosts(r))
      .catch(() => setPosts({ now: new Date().toISOString(), posts: [] }));
    return () => ac.abort();
  }, []);

  const grouped = useMemo(() => {
    const now = discovery?.now ?? new Date().toISOString();
    const by: Record<string, DiscoveryCandidatePublic[]> = {};
    for (const c of discovery?.candidates ?? []) {
      const k = c.retailer;
      by[k] = by[k] ?? [];
      by[k]!.push(c);
    }
    const entries = Object.entries(by)
      .map(([retailer, items]) => {
        const latest = items.reduce((acc, x) => (x.discoveredAt > acc ? x.discoveredAt : acc), items[0]?.discoveredAt ?? now);
        return { retailer: retailer as DiscoveryCandidatePublic['retailer'], items, latestDiscoveredAt: latest };
      })
      .sort((a, b) => (a.retailer < b.retailer ? -1 : a.retailer > b.retailer ? 1 : 0));
    return { now, entries };
  }, [discovery]);

  return (
    <div className="space-y-12">
      {/* 1) Hero Header (locked) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 via-white to-red-50 shadow-sm border border-slate-200 p-8 md:p-12">
        <div className="relative grid gap-8 md:grid-cols-[1fr_360px]">
          <div>
            <div className="flex items-center gap-3">
              <Logo className="h-9 w-auto" />
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{siteConfig.countryCode}</span>
            </div>

            <div className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">{name}</div>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-slate-950">
              Live deals, updated regularly.
            </h1>
            <div className="mt-2 text-sm text-slate-700">Non-commercial discovery feed updates throughout the day.</div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/deals"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                View deals
              </Link>
              <Link
                to="/products"
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Browse products
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-medium text-slate-900">Discovery (non-affiliate)</div>
              <div className="text-xs text-slate-600">
                Links are plain URLs and are <span className="font-medium">not</span> affiliate links.
              </div>
              {discoveryErr ? <div className="text-xs text-rose-800">{discoveryErr}</div> : null}
              {!discovery ? <div className="text-xs text-slate-600">Loading…</div> : null}
              {discovery && discovery.candidates.length === 0 ? <div className="text-xs text-slate-600">No discoveries yet.</div> : null}
              {discovery && discovery.candidates.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {(grouped.entries[0]?.items ?? []).slice(0, 3).map((c) => (
                    <li key={c.id} className="text-xs">
                      {!isDead((c as any).linkStatus) ? (
                        <a className="font-medium text-slate-900 hover:underline" href={c.outboundUrl} target="_blank" rel="noreferrer">
                          {c.title}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-500">{c.title}</span>
                      )}
                      <div className="text-[11px] text-slate-600">
                        {retailerLabel(c.retailer)}
                        {c.category ? ` · ${c.category}` : ''} · Updated {hoursAgo(grouped.now, c.discoveredAt)}h ago
                      </div>
                      {isDead((c as any).linkStatus) ? <div className="text-[11px] text-amber-700">Link currently unavailable</div> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* 2) Live Deals Grid (locked) */}
      <section id="deals" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8 scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Live Deals</h2>
          <div className="text-sm text-slate-600">Sorted by backend priority</div>
        </div>
        {/* Until deals are present, show non-commercial discovery feed instead of a scanning placeholder. */}
        {!discovery ? (
          <div className="mt-4 text-sm text-slate-600">Loading…</div>
        ) : discovery.candidates.length === 0 ? (
          <EmptyState
            title="No discoveries yet"
            body="Once discovery runs, this feed will populate automatically (non-commercial)."
          />
        ) : (
          <div className="mt-4 space-y-4">
            <div className="text-xs text-slate-600">
              Non-affiliate disclosure: outbound links in this section are plain URLs and do not include affiliate tracking.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {grouped.entries.map((g) => (
                <div key={g.retailer} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-medium text-slate-900">{retailerLabel(g.retailer)}</div>
                    <div className="text-xs text-slate-500">Updated {hoursAgo(grouped.now, g.latestDiscoveredAt)}h ago</div>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm">
                    {g.items.slice(0, 10).map((c) => (
                      <li key={c.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <div className="flex gap-3">
                          <ProductImage
                            size={150}
                            imageUrl={(c as any).thumbnailUrl}
                            categoryPlaceholderUrl={(c as any).categoryPlaceholderUrl ?? null}
                          />
                          <div className="min-w-0 flex-1">
                            {!isDead((c as any).linkStatus) ? (
                              <a className="font-medium text-slate-900 hover:underline" href={c.outboundUrl} target="_blank" rel="noreferrer">
                                {c.title}
                              </a>
                            ) : (
                              <div className="font-medium text-slate-500">{c.title}</div>
                            )}
                            <div className="mt-1 text-xs text-slate-600">
                              {(c as any).shortDescription ? (c as any).shortDescription : c.description ? c.description : '—'}
                            </div>
                            <div className="mt-2 text-xs text-slate-600">
                              {c.category ? c.category : '—'} · confidence {c.confidenceScore != null ? c.confidenceScore.toFixed(2) : '—'}
                            </div>
                            {isDead((c as any).linkStatus) ? <div className="mt-2 text-xs text-amber-700">Link currently unavailable</div> : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* U5) Latest unaffiliated posts */}
      <section id="posts" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8 scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Latest posts</h2>
          <Link to="/posts" className="text-sm text-slate-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          These posts are for informational purposes only. Links are non-affiliate.
        </div>
        {!posts ? (
          <div className="mt-4 text-sm text-slate-600">Loading…</div>
        ) : posts.posts.length === 0 ? (
          <div className="mt-4 text-sm text-slate-600">No posts yet.</div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {posts.posts.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex gap-3">
                  <ProductImage
                    size={150}
                    imageUrl={(p as any).thumbnailUrl}
                    categoryPlaceholderUrl={(p as any).categoryPlaceholderUrl ?? null}
                  />
                  <div className="min-w-0 flex-1">
                    <Link to={`/posts/${encodeURIComponent(p.slug)}`} className="font-medium text-slate-900 hover:underline">
                      {p.title}
                    </Link>
                    <div className="mt-1 text-xs text-slate-600">
                      {p.retailer} · {p.category}
                    </div>
                    <div className="mt-2 text-xs text-slate-600">{(p as any).shortDescription ?? '—'}</div>
                    {(() => {
                      const t = (p as any).lastCheckedAt ?? p.publishedAt ?? p.createdAt;
                      const cd = countdownFromIso(p.expiresAt, new Date(nowMs));
                      if (!t || cd?.state === 'expired') return null;
                      const d = new Date(t);
                      const mins = Math.max(0, Math.floor((nowMs - d.getTime()) / 60000));
                      if (mins >= 120) return null;
                      const cls = mins < 30 ? 'mt-2 text-xs font-medium text-emerald-700' : 'mt-2 text-xs text-slate-600';
                      return <div className={cls}>Updated {relativeTimeFrom(d, new Date(nowMs))}</div>;
                    })()}
                    <div className="mt-3 text-sm text-slate-700">{p.summary}</div>
                    {(() => {
                      const c = countdownFromIso(p.expiresAt, new Date(nowMs));
                      if (!c) return null;
                      const cls = c.state === 'expired' ? 'mt-2 text-xs text-slate-500' : c.state === 'urgent' ? 'mt-2 text-xs text-amber-700' : 'mt-2 text-xs text-slate-600';
                      return <div className={cls}>{c.label}</div>;
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3) Trending Categories (locked) */}
      <section id="categories" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8 scroll-mt-24">
        <h2 className="text-lg font-semibold text-slate-900">Trending Categories</h2>
        <EmptyState
          title="Categories are warming up"
          body="As deals land, this section fills automatically with what’s active right now."
        />
      </section>

      {/* 4) Editor’s Picks (locked) */}
      <section id="about" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8 scroll-mt-24">
        <h2 className="text-lg font-semibold text-slate-900">Editor’s Picks</h2>
        <EmptyState
          title="Editor’s Picks refresh throughout the day"
          body="This section highlights a small set of deals that meet our quality and urgency rules."
        />
      </section>

      <section id="how" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8 scroll-mt-24">
        <h2 className="text-lg font-semibold text-slate-900">How It Works</h2>
        <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            Deals are ingested automatically and expire on schedule—no manual edits.
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            Discovery links are non-commercial and do not use affiliate tracking. Deals links may be affiliate-wrapped when enabled.
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

