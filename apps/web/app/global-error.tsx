'use client';

import { useEffect } from 'react';

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(props.error);
  }, [props.error]);

  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-slate-900 antialiased">
        <main className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm text-slate-600">We couldn’t load this page right now. Please try again.</p>
          <button
            onClick={() => {
              if (typeof props.reset === 'function') props.reset();
              else window.location.reload();
            }}
            className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}

