import type { ReactNode } from 'react';
import './globals.css';
import { getResolvedSiteKey } from '@/src/server/site';
import { getGaConfigForSite } from '@/src/server/analytics/config';
import { GoogleAnalytics } from '@/src/components/public/GoogleAnalytics';
import { getCurrentSite } from '@/src/server/site';
import { SiteHeader } from '@/src/components/site/SiteHeader';

export const metadata = {
  title: 'trendsinusa.com',
  description: 'Trends + deals in the USA.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const siteKey = await getResolvedSiteKey();
  const ga = await getGaConfigForSite(siteKey);
  const site = await getCurrentSite();
  const title = site?.name ?? 'Trends';
  return (
    <html lang="en">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        <GoogleAnalytics enabled={ga.enabled} measurementId={ga.measurementId} />
        <SiteHeader title={title} />
        {children}
      </body>
    </html>
  );
}

