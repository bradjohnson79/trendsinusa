import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { getProductByAsin, getActiveDealForAsin } from '@/src/server/public/queries';
import { buildOutboundAmazonLink } from '@/src/server/affiliate/linkBuilder';
import { getCurrentSite } from '@/src/server/site';
import { Footer } from '@/src/components/public/Footer';
import { TrackImpression } from '@/src/components/public/TrackImpression';
import { DealCard } from '@/src/components/site/DealCard';
import { AffiliateDisclosureInline } from '@/src/components/public/AffiliateDisclosureInline';
import { EmptyState } from '@/src/components/site/EmptyState';
import { buildSeoMeta } from '@/src/server/seo/meta';

function isStale(sourceFetchedAt: Date | null): boolean {
  if (!sourceFetchedAt) return true;
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  return sourceFetchedAt.getTime() < cutoff;
}

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

export async function generateMetadata(props: { params: Promise<{ asin: string }> }): Promise<Metadata> {
  const { asin } = await props.params;
  const site = await getCurrentSite();
  const product = await getProductByAsin(asin);
  if (!product) return { title: 'Not found', robots: { index: false, follow: false } };

  const name = site?.name ?? 'Trends';
  return buildSeoMeta({
    title: `${product.title} — ${name}`,
    description: `Product details for ${product.title}.`,
    canonicalPath: `/product/${encodeURIComponent(asin)}`,
  });
}

export default async function ProductPage(props: { params: Promise<{ asin: string }> }) {
  const { asin } = await props.params;
  const [product, deal, site] = await Promise.all([getProductByAsin(asin), getActiveDealForAsin(asin), getCurrentSite()]);
  if (!product) return notFound();
  const stale = isStale(product.sourceFetchedAt ?? null);

  const affiliate = deal && !stale
    ? await buildOutboundAmazonLink({
        asin,
        section: 'product_detail',
        ctaVariant: 'view_deal',
        badgeVariant: 'default',
        dealStatus: deal.status,
        dealId: deal.id,
      })
    : null;

  const provider = affiliate?.ok ? providerFromOutbound(affiliate.url) : 'amazon';

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <TrackImpression payload={{ event: 'view_item', section: 'product_detail', asin }} />

      <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-[360px_1fr]">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.title} fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">No image</div>
          )}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{site?.name ?? 'Site'}</div>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-slate-950">{product.title}</h1>
          {product.aiFinalSummary ? (
            <p className="mt-4 text-sm leading-6 text-slate-700">{product.aiFinalSummary}</p>
          ) : null}

          <div className="mt-6">
            {stale ? (
              <EmptyState
                title="Temporarily unavailable"
                body="We’re refreshing verified product data from Amazon. Please check back shortly."
              />
            ) : deal && affiliate?.ok ? (
              <>
                <DealCard variant="featured" deal={deal} provider={provider} outboundUrl={affiliate.url} section="product_detail" />
                <AffiliateDisclosureInline />
              </>
            ) : (
              <EmptyState
                title="No live deal at the moment"
                body="This product rotates in and out of active deals. Check back later for a refreshed offer."
              />
            )}
          </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

