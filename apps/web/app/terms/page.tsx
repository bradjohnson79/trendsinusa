import type { Metadata } from 'next';

import { Footer } from '@/src/components/public/Footer';
import { buildSeoMeta } from '@/src/server/seo/meta';

export async function generateMetadata(): Promise<Metadata> {
  return buildSeoMeta({
    title: 'Terms & Conditions — TrendsInUSA.com',
    description: 'Terms and conditions for using TrendsInUSA.com.',
    canonicalPath: '/terms',
  });
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-slate-950">Terms &amp; Conditions</h1>

        <div className="mt-4 space-y-4 text-sm text-slate-600">
          <p>
            TrendsInUSA.com provides deal information “as is” for informational purposes. Prices, availability, and
            promotions can change without notice.
          </p>
          <p>
            You are responsible for verifying final details on the retailer’s site before purchasing. We do not provide
            warranties and do not guarantee the accuracy of listings at any given moment.
          </p>
          <p>
            By using this site, you agree not to misuse it, attempt to disrupt service, or access restricted areas
            without authorization.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}

