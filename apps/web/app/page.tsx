import Link from 'next/link';
import type { Metadata } from 'next';

import { buildOutboundAmazonLink } from '@/src/server/affiliate/linkBuilder';
import {
  getHomepageHero,
} from '@/src/server/public/queries';
import { getLiveCategories } from '@/src/server/public/seoPages';
import { Footer } from '@/src/components/public/Footer';
import { getCurrentSite } from '@/src/server/site';
import { getEditorPicks, getHeroBackground, getHeroFeaturedDeal, getHomeLiveDeals } from '@/src/server/public/frontend';
import { DealCard } from '@/src/components/site/DealCard';
import { CountdownTimer } from '@/src/components/site/CountdownTimer';
import { ProviderBadge } from '@/src/components/site/ProviderBadge';
import { TrackImpression } from '@/src/components/public/TrackImpression';
import { EmptyState } from '@/src/components/site/EmptyState';
import { buildSeoMeta } from '@/src/server/seo/meta';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  const name = site?.name ?? 'Trends';
  return buildSeoMeta({
    title: `${name} — Live deals & trending categories`,
    description: 'Live deals and trending categories. Updated regularly.',
    canonicalPath: '/',
  });
}

export default async function HomePage() {
  const site = await getCurrentSite();
  const [heroCopy, heroBackground, heroDeal, liveDeals, categories, picks] = await Promise.all([
    getHomepageHero(),
    getHeroBackground(),
    getHeroFeaturedDeal(),
    getHomeLiveDeals(12),
    getLiveCategories(),
    getEditorPicks(6),
  ]);

  const name = site?.name ?? 'Trends';

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

  const heroAffiliate =
    heroDeal &&
    (await buildOutboundAmazonLink({
      asin: heroDeal.product.asin,
      section: 'home_hero',
      ctaVariant: 'view_deal',
      badgeVariant: 'default',
      dealStatus: heroDeal.status,
      dealId: heroDeal.id,
    }));
  const heroProvider = heroAffiliate && heroAffiliate.ok ? providerFromOutbound(heroAffiliate.url) : 'amazon';

  const liveAffiliate = await Promise.all(
    liveDeals.map((d) =>
      buildOutboundAmazonLink({
        asin: d.product.asin,
        section: 'home_live',
        ctaVariant: 'view_deal',
        badgeVariant: 'default',
        dealStatus: d.status,
        dealId: d.id,
      }),
    ),
  );

  const picksAffiliate = await Promise.all(
    picks.map((d) =>
      buildOutboundAmazonLink({
        asin: d.product.asin,
        section: 'home_picks',
        ctaVariant: 'view_deal',
        badgeVariant: 'default',
        dealStatus: d.status,
        dealId: d.id,
      }),
    ),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
      <TrackImpression payload={{ event: 'page_view', section: 'home' }} />

      {/* 1) Hero Header (locked) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 via-white to-red-50 shadow-sm border border-slate-200 p-8 md:p-12">
        {heroBackground?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroBackground.imageUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15"
          />
        ) : null}

        <div className="relative grid gap-8 md:grid-cols-[1fr_360px]">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{name}</div>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-slate-950">
              {heroCopy?.headline ?? 'Live deals, updated regularly.'}
            </h1>
            <div className="mt-2 text-sm text-slate-700">
              {heroCopy ? 'Updated today' : 'Scanning for fresh deals and rotating picks…'}
            </div>

            {heroDeal ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <ProviderBadge provider={heroProvider} />
                <span className="text-slate-500">•</span>
                <span className="font-medium">Featured deal ends in</span>
                <CountdownTimer expiresAtMs={heroDeal.expiresAt.getTime()} />
              </div>
            ) : null}
          </div>

          <div className="relative">
            {heroDeal && heroAffiliate && heroAffiliate.ok ? (
              <DealCard
                variant="featured"
                deal={heroDeal}
                provider={heroProvider}
                outboundUrl={heroAffiliate.url}
                section="home_hero"
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-700 shadow-sm">
                🔥 Scanning for the hottest deals right now…
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2) Live Deals Grid (locked) */}
      <section id="deals" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8 scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Live Deals</h2>
          <div className="text-sm text-slate-600">Sorted by backend priority</div>
        </div>
        {liveDeals.length === 0 ? (
          <EmptyState
            title="Scanning for live deals"
            body="We’re refreshing the feed. Check back soon—new deals roll in throughout the day."
            tone="scanning"
          />
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {liveDeals.map((d, idx) => {
              const a = liveAffiliate[idx]!;
              if (!a.ok) return null;
              const provider = providerFromOutbound(a.url);
              return (
                <DealCard key={d.id} variant="default" deal={d} provider={provider} outboundUrl={a.url} section="home_live" />
              );
            })}
          </div>
        )}
      </section>

      {/* 3) Trending Categories (locked) */}
      <section id="categories" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8 scroll-mt-24">
        <h2 className="text-lg font-semibold text-slate-900">Trending Categories</h2>
        {categories.length === 0 ? (
          <EmptyState
            title="Categories are warming up"
            body="As deals land, this section fills automatically with what’s active right now."
          />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {categories.slice(0, 12).map((c) => (
              <Link
                key={c}
                href={`/category/${encodeURIComponent(c)}`}
                className="rounded-xl bg-gradient-to-br from-slate-100 to-white border border-slate-200 p-4 text-center font-medium text-slate-900 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200"
              >
                {c}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4) AI Picks / Editor’s Picks (locked) */}
      <section id="about" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8 scroll-mt-24">
        <h2 className="text-lg font-semibold text-slate-900">Editor’s Picks</h2>
        {picks.length === 0 ? (
          <EmptyState
            title="Editor’s Picks refresh throughout the day"
            body="This section highlights a small set of deals that meet our quality and urgency rules."
          />
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {picks.map((d, idx) => {
              const a = picksAffiliate[idx]!;
              if (!a.ok) return null;
              const provider = providerFromOutbound(a.url);
              return (
                <DealCard key={d.id} variant="default" deal={d} provider={provider} outboundUrl={a.url} section="home_picks" />
              );
            })}
          </div>
        )}
      </section>

      <section id="how" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8 scroll-mt-24">
        <h2 className="text-lg font-semibold text-slate-900">How It Works</h2>
        <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            Deals are ingested automatically and expire on schedule—no manual edits.
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            Outbound links are verified and wrapped through our affiliate engine for consistency.
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

