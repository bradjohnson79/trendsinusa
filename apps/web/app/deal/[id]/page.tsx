import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { getPublicDealById } from '@/src/server/public/frontend';
import { buildOutboundAmazonLink } from '@/src/server/affiliate/linkBuilder';
import { getCurrentSite } from '@/src/server/site';
import { TrackImpression } from '@/src/components/public/TrackImpression';
import { DealCard } from '@/src/components/site/DealCard';
import { Footer } from '@/src/components/public/Footer';
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

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  const site = await getCurrentSite();
  const deal = await getPublicDealById(id);
  if (!deal) return { title: 'Not found', robots: { index: false, follow: false } };

  const name = site?.name ?? 'Trends';
  const expiresIso = deal.expiresAt.toISOString();
  return buildSeoMeta({
    title: `${deal.product.title} — Deal — ${name}`,
    description: `Live deal on ${deal.product.title}. Expires ${expiresIso}.`,
    canonicalPath: `/deal/${encodeURIComponent(id)}`,
  });
}

export default async function DealDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const deal = await getPublicDealById(id);
  if (!deal) return notFound();
  const stale = isStale(deal.product.sourceFetchedAt ?? null);

  const affiliate = stale
    ? { ok: false as const, reason: 'stale' as const }
    : await buildOutboundAmazonLink({
        asin: deal.product.asin,
        section: 'deal_detail',
        ctaVariant: 'view_deal',
        badgeVariant: 'default',
        dealStatus: deal.status,
        dealId: deal.id,
      });

  const provider = affiliate.ok ? providerFromOutbound(affiliate.url) : 'amazon';

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <TrackImpression
        payload={{
          event: 'view_deal',
          section: 'deal_detail',
          asin: deal.product.asin,
          dealId: deal.id,
          dealStatus: deal.status,
          ...(affiliate.ok ? { provider } : {}),
        }}
      />

      <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-[360px_1fr]">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100">
          {deal.product.imageUrl ? (
            <Image src={deal.product.imageUrl} alt={deal.product.title} fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">No image</div>
          )}
          </div>

          <div className="min-w-0">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-950">
              {deal.product.title}
            </h1>
          {/* Compliance: avoid rendering AI copy that isn't sourced/controlled here. */}

          <div className="mt-6">
            {stale ? (
              <EmptyState
                title="Temporarily unavailable"
                body="We’re refreshing verified product data from Amazon. Please check back shortly."
              />
            ) : affiliate.ok ? (
              <>
                <DealCard variant="featured" deal={deal} provider={provider} outboundUrl={affiliate.url} section="deal_detail" />
                <AffiliateDisclosureInline />
              </>
            ) : (
              <EmptyState
                title="Link is being prepared"
                body="We’re verifying the outbound link for consistency. Please try again shortly."
                tone="scanning"
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

