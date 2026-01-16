'use client';

import Link from 'next/link';

import type { AffiliateLinkResult } from '@trendsinusa/shared';

export function AffiliateCta(props: { result: AffiliateLinkResult }) {
  if (!props.result.ok) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Affiliate link unavailable ({props.result.reason}). Please check back soon.
      </div>
    );
  }

  return (
    <Link
      href={props.result.url}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      View on Amazon
    </Link>
  );
}

