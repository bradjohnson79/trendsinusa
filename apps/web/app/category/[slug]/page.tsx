import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getLiveDealsByCategory } from '@/src/server/public/seoPages';
import { buildOutboundAmazonLink } from '@/src/server/affiliate/linkBuilder';
import { getCurrentSite } from '@/src/server/site';
import { TrackImpression } from '@/src/components/public/TrackImpression';
import { DealCard } from '@/src/components/site/DealCard';
import { Footer } from '@/src/components/public/Footer';
import { EmptyState } from '@/src/components/site/EmptyState';
import { buildSeoMeta } from '@/src/server/seo/meta';

function providerFromOutbound(outboundUrl: string): string {
  try {
    const u = new URL(outboundUrl, 'http://local');
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'out') return 'amazon';
    return parts[1] ?? 'amazon';
  } catch {
    return 'amazon';
  }
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const category = decodeURIComponent(slug);
  const site = await getCurrentSite();
  const name = site?.name ?? 'Trends';
  return buildSeoMeta({
    title: `${category} deals — ${name}`,
    description: `Live deals in ${category}. Updated regularly.`,
    canonicalPath: `/category/${encodeURIComponent(slug)}`,
  });
}

export default async function CategoryPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const category = decodeURIComponent(slug);
  if (!category) return notFound();

  const deals = await getLiveDealsByCategory(category, 60);
  const affiliate = await Promise.all(
    deals.map((d) =>
      buildOutboundAmazonLink({
        asin: d.product.asin,
        section: 'category',
        ctaVariant: 'view_deal',
        badgeVariant: 'default',
        dealStatus: d.status,
        dealId: d.id,
      }),
    ),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <TrackImpression payload={{ event: 'page_view', section: 'category' }} />

      <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{category}</h1>
          <div className="text-sm text-slate-600">{deals.length} live deals</div>
        </div>

        {deals.length === 0 ? (
          <EmptyState
            title="No active deals in this category right now"
            body="This category updates automatically as new deals land. Check back soon."
            tone="scanning"
          />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deals.map((d, idx) => {
              const a = affiliate[idx]!;
              const provider = a.ok ? providerFromOutbound(a.url) : 'amazon';
              return a.ok ? (
                <DealCard
                  key={d.id}
                  variant="compact"
                  deal={d}
                  provider={provider}
                  outboundUrl={a.url}
                  section="category"
                />
              ) : null;
            })}
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

