import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { UnaffiliatedPostPublic, UnaffiliatedPostsResponse } from '@trendsinusa/shared/api';
import { api, ApiClientError } from '@/lib/api';
import { setSeo } from '@/lib/seo';
import { siteConfig } from '@/sites/config';

function isDead(linkStatus: any) {
  return String(linkStatus ?? '').toUpperCase() === 'DEAD';
}

function hoursAgo(nowIso: string, thenIso: string | null) {
  if (!thenIso) return null;
  const now = new Date(nowIso).getTime();
  const then = new Date(thenIso).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now - then) / (60 * 60 * 1000)));
}

export function PostsPage() {
  const [data, setData] = useState<UnaffiliatedPostsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSeo({
      title: `Posts · ${siteConfig.branding.name}`,
      description: 'Informational posts generated from neutral discovery. Links are non-affiliate.',
      url: `${window.location.origin}/posts`,
    });
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    api.posts
      .list(ac.signal, { limit: 50 })
      .then((r) => setData(r))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErr(e instanceof ApiClientError ? e.message : 'Failed to load posts');
      });
    return () => ac.abort();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.posts ?? []) set.add(p.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const now = data?.now ?? new Date().toISOString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Posts</h1>
        <p className="mt-2 text-slate-700">Informational posts only. Links are non-affiliate.</p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        These posts are for informational purposes only. Links are non-affiliate.
      </div>

      {err ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}

      {!data ? (
        <div className="text-sm text-slate-600">Loading…</div>
      ) : data.posts.length === 0 ? (
        <div className="text-sm text-slate-600">No posts yet.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-900">Categories</div>
            <div className="mt-3 space-y-2">
              {categories.map((c) => (
                <Link key={c} to={`/posts/category/${encodeURIComponent(c)}`} className="block text-sm text-slate-700 hover:underline">
                  {c}
                </Link>
              ))}
            </div>
          </aside>

          <div className="space-y-3">
            {data.posts.map((p: UnaffiliatedPostPublic) => (
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
                      <div className="text-xs text-slate-500">
                        {p.publishedAt ? `Updated ${hoursAgo(now, p.publishedAt)}h ago` : '—'}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {p.retailer} · {p.category}
                    </div>
                    <div className="mt-2 text-xs text-slate-600">{(p as any).shortDescription ?? '—'}</div>
                    <div className="mt-3 text-sm text-slate-700">{p.summary}</div>
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
        </div>
      )}
    </div>
  );
}

