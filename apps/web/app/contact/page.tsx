import type { Metadata } from 'next';

import { Footer } from '@/src/components/public/Footer';
import { buildSeoMeta } from '@/src/server/seo/meta';

export async function generateMetadata(): Promise<Metadata> {
  return buildSeoMeta({
    title: 'Contact — TrendsInUSA.com',
    description: 'How to contact TrendsInUSA.com.',
    canonicalPath: '/contact',
  });
}

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-slate-950">Contact</h1>
        <p className="mt-3 text-sm text-slate-600">
          For partnerships, corrections, or support, email us at{' '}
          <span className="font-medium text-slate-800">support@trendsinusa.com</span>.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Note: this is a static trust page. We’ll wire a real contact workflow later.
        </p>
      </section>

      <Footer />
    </main>
  );
}

