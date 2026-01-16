import Link from 'next/link';

export function AffiliateDisclosureInline() {
  return (
    <div className="mt-3 text-xs text-slate-500">
      As an affiliate, we may earn from qualifying purchases.{' '}
      <Link href="/affiliate-disclosure" className="underline underline-offset-2 hover:text-slate-700 transition">
        Learn more
      </Link>
      .
    </div>
  );
}

