import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { UnaffiliatedPostPublic, UnaffiliatedPostsResponse } from '@trendsinusa/shared/api';
import { api, ApiClientError } from '@/lib/api';
import { setSeo } from '@/lib/seo';
import { countdownFromIso, relativeTimeFrom } from '@/lib/format';
import { siteConfig } from '@/sites/config';

function isDead(linkStatus: any) {
  return String(linkStatus ?? '').toUpperCase() === 'DEAD';
}

export function PostCategoryPage() {
  const params = useParams();
  const category = params.category ? decodeURIComponent(params.category) : '';

  const [data, setData] = useState<UnaffiliatedPostsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSeo({
      title: `${category || 'Category'} · Posts · ${siteConfig.branding.name}`,
      description: `Informational posts in ${category || 'this category'}. Links are non-affiliate.`,
      url: `${window.location.origin}/posts/category/${encodeURIComponent(category)}`,
    });
  }, [category]);

  useEffect(() => {
    const ac = new AbortController();
    api.posts
      .list(ac.signal, { limit: 50, category })
      .then((r) => setData(r))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErr(e instanceof ApiClientError ? e.message : 'Failed to load posts');
      });
    return () => ac.abort();
  }, [category]);

  const posts = data?.posts ?? [];

  const retailers = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) set.add(p.retailer);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{category || 'Category'}</h1>
        <p className="mt-2 text-slate-700">Informational posts only. Links are non-affiliate.</p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        These posts are for informational purposes only. Links are non-affiliate.
      </div>

      <div className="text-sm">
        <Link className="text-slate-700 hover:underline" to="/posts">
          ← All posts
        </Link>
      </div>

      {err ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}

      {!data ? (
        <div className="text-sm text-slate-600">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-sm text-slate-600">No posts for this category.</div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">Retailers: {retailers.join(', ') || '—'}</div>
          {posts.map((p: UnaffiliatedPostPublic) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex gap-3">
                {(p as any).thumbnailUrl ? (
                  <img
                    src={(p as any).thumbnailUrl}
                    alt=""
                    width={150}
                    height={150}
                    className="h-[150px] w-[150px] rounded-md border border-slate-200 bg-white object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-[150px] w-[150px] rounded-md border border-slate-200 bg-white" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link to={`/posts/${encodeURIComponent(p.slug)}`} className="font-medium text-slate-900 hover:underline">
                      {p.title}
                    </Link>
                    <div className="text-xs text-slate-500">{p.retailer}</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">{(p as any).shortDescription ?? '—'}</div>
                    {(() => {
                      const t = (p as any).lastCheckedAt ?? p.publishedAt ?? p.createdAt;
                      const cd = countdownFromIso(p.expiresAt, new Date(now));
                      if (!t || cd?.state === 'expired') return null;
                      const d = new Date(t);
                      const mins = Math.max(0, Math.floor((new Date(now).getTime() - d.getTime()) / 60000));
                      if (mins >= 120) return null;
                      const cls = mins < 30 ? 'mt-2 text-xs font-medium text-emerald-700' : 'mt-2 text-xs text-slate-600';
                      return <div className={cls}>Updated {relativeTimeFrom(d, new Date(now))}</div>;
                    })()}
                  <div className="mt-3 text-sm text-slate-700">{p.summary}</div>
                    {(() => {
                      const c = countdownFromIso(p.expiresAt, new Date(now));
                      if (!c) return null;
                      const cls = c.state === 'expired' ? 'mt-2 text-xs text-slate-500' : c.state === 'urgent' ? 'mt-2 text-xs text-amber-700' : 'mt-2 text-xs text-slate-600';
                      return <div className={cls}>{c.label}</div>;
                    })()}
                  <div className="mt-3 text-xs">
                    {!isDead((p as any).linkStatus) ? (
                      <a href={p.outboundUrl} target="_blank" rel="noreferrer" className="text-slate-600 hover:underline">
                        View on retailer site
                      </a>
                    ) : (
                      <span className="text-amber-700">Link currently unavailable</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

