import type { Metadata } from 'next';

import { Footer } from '@/src/components/public/Footer';
import { buildSeoMeta } from '@/src/server/seo/meta';

export async function generateMetadata(): Promise<Metadata> {
  return buildSeoMeta({
    title: 'Privacy Policy — TrendsInUSA.com',
    description: 'Privacy policy for TrendsInUSA.com.',
    canonicalPath: '/privacy',
  });
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-slate-950">Privacy Policy</h1>

        <div className="mt-4 space-y-4 text-sm text-slate-600">
          <p>
            We aim to keep data collection minimal. We record basic interaction events (e.g., impressions and outbound
            clicks) to improve site quality and reliability.
          </p>
          <p>
            We do not intentionally collect sensitive personal information. If you contact us by email, we will use your
            message only to respond.
          </p>
          <p>
            Third-party retailers may collect data when you click through to their sites. Please review their policies
            for details.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}

