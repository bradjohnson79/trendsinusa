import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { UnaffiliatedPostDetailResponse } from '@trendsinusa/shared/api';
import { api, ApiClientError } from '@/lib/api';
import { setSeo } from '@/lib/seo';
import { siteConfig } from '@/sites/config';

function renderMarkdownLite(md: string) {
  // Minimal, safe-ish renderer to avoid adding deps. Supports headings and paragraphs.
  // NOTE: This intentionally does NOT render arbitrary HTML.
  const lines = md.split('\n');
  const out: Array<{ type: 'h2' | 'p' | 'li'; text: string }> = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) out.push({ type: 'h2', text: line.slice(3).trim() });
    else if (line.startsWith('- ')) out.push({ type: 'li', text: line.slice(2).trim() });
    else out.push({ type: 'p', text: line });
  }
  return out;
}

export function PostPage() {
  const params = useParams();
  const slug = params.slug ? decodeURIComponent(params.slug) : '';

  const [post, setPost] = useState<UnaffiliatedPostDetailResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api.posts
      .getBySlug(slug, ac.signal)
      .then((r) => setPost(r))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErr(e instanceof ApiClientError ? e.message : 'Failed to load post');
      });
    return () => ac.abort();
  }, [slug]);

  const url = `${window.location.origin}/posts/${encodeURIComponent(slug)}`;

  useEffect(() => {
    if (!post) return;
    const desc = post.summary.slice(0, 160);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      datePublished: post.publishedAt ?? post.createdAt,
      dateModified: post.updatedAt,
      articleSection: post.category,
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: siteConfig.branding.name },
      publisher: { '@type': 'Organization', name: siteConfig.branding.name },
    };
    setSeo({
      title: `${post.title} · ${siteConfig.branding.name}`,
      description: desc,
      url,
      jsonLdId: `post:${post.slug}`,
      jsonLd,
    });
  }, [post, url]);

  const blocks = useMemo(() => (post ? renderMarkdownLite(post.body) : []), [post]);

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link className="text-slate-700 hover:underline" to="/posts">
          ← Posts
        </Link>
        {post ? (
          <>
            <span className="mx-2 text-slate-400">/</span>
            <Link className="text-slate-700 hover:underline" to={`/posts/category/${encodeURIComponent(post.category)}`}>
              {post.category}
            </Link>
          </>
        ) : null}
      </div>

      {err ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}

      {!post ? (
        <div className="text-sm text-slate-600">Loading…</div>
      ) : (
        <article className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
          <div className="text-xs text-slate-500">
            {post.retailer} · {post.category} · Published {post.publishedAt ?? post.createdAt}
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            These posts are for informational purposes only. Links are non-affiliate.
          </div>

          <div className="prose prose-slate max-w-none">
            {blocks.map((b, idx) => {
              if (b.type === 'h2') return <h2 key={idx} className="text-lg font-semibold text-slate-900 mt-6">{b.text}</h2>;
              if (b.type === 'li') return <li key={idx} className="text-slate-700">{b.text}</li>;
              return <p key={idx} className="text-slate-700">{b.text}</p>;
            })}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div className="text-xs font-medium text-slate-900">View on retailer site</div>
            <a href={post.outboundUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-slate-700 hover:underline break-all">
              {post.outboundUrl}
            </a>
          </div>
        </article>
      )}
    </div>
  );
}

