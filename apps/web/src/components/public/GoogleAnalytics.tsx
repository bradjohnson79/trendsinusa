'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

export function GoogleAnalytics(props: { enabled: boolean; measurementId: string | null }) {
  const pathname = usePathname();

  // Never track admin routes.
  if (pathname.startsWith('/admin')) return null;
  if (!props.enabled) return null;
  if (!props.measurementId) return null;

  const id = props.measurementId;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${id}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}

