import type { Metadata } from 'next';

import { Footer } from '@/src/components/public/Footer';
import { buildSeoMeta } from '@/src/server/seo/meta';

export async function generateMetadata(): Promise<Metadata> {
  return buildSeoMeta({
    title: 'Affiliate Disclosure — TrendsInUSA.com',
    description: 'Affiliate disclosure for TrendsInUSA.com.',
    canonicalPath: '/affiliate-disclosure',
  });
}

export default function AffiliateDisclosurePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-slate-950">Affiliate Disclosure</h1>

        <div className="mt-4 space-y-4 text-sm text-slate-600">
          <p>
            TrendsInUSA.com participates in affiliate programs. This means we may earn a commission if you click a link
            and make a purchase, at no additional cost to you.
          </p>
          <p>
            We prioritize clarity and accuracy. Deal ordering and visibility are determined by data signals (e.g. expiry
            and availability) and internal quality rules—not by advertisers.
          </p>
          <p>Retailer trademarks and logos belong to their respective owners.</p>
        </div>
      </section>

      <Footer />
    </main>
  );
}

