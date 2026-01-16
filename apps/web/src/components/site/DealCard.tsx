import Image from 'next/image';
import Link from 'next/link';

import type { Deal, Product } from '@prisma/client';

import { formatMoney } from '@/src/lib/format';
import { CountdownTimer } from './CountdownTimer';
import { ProviderBadge } from './ProviderBadge';
import { TrackedLink } from './TrackedLink';

type DealWithProduct = Deal & { product: Product };

function discountPercent(d: DealWithProduct): number | null {
  if (d.discountPercent != null) return d.discountPercent;
  if (d.oldPriceCents != null && d.oldPriceCents > d.currentPriceCents && d.oldPriceCents > 0) {
    return Math.round(((d.oldPriceCents - d.currentPriceCents) / d.oldPriceCents) * 100);
  }
  return null;
}

function urgencyTone(status: string) {
  const st = status.toUpperCase();
  if (st === 'EXPIRING_1H') return 'bg-red-600 text-white';
  if (st === 'EXPIRING_6H') return 'bg-orange-500 text-white';
  if (st === 'EXPIRING_24H') return 'bg-blue-600 text-white';
  return 'bg-slate-900 text-white';
}

export function DealCard(props: {
  variant: 'default' | 'featured' | 'compact';
  deal: DealWithProduct;
  provider: string;
  outboundUrl: string; // internal /out/... URL
  section: string;
}) {
  const d = props.deal;
  const pct = discountPercent(d);

  const card =
    props.variant === 'featured'
      ? 'group grid gap-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-6 md:grid-cols-[220px_1fr]'
      : props.variant === 'compact'
        ? 'group flex gap-3 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-3'
        : 'group flex gap-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4';

  const imageClass =
    props.variant === 'featured'
      ? 'relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 md:h-[220px] md:w-[220px]'
      : 'relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100';

  function shouldShowDisclosure(outboundUrl: string): boolean {
    try {
      const u = new URL(outboundUrl, 'http://local');
      const parts = u.pathname.split('/').filter(Boolean);
      // /out/merchant/... is clean (no affiliate injection) -> no affiliate disclosure
      return !(parts[0] === 'out' && parts[1] === 'merchant');
    } catch {
      return true;
    }
  }

  return (
    <div className={card}>
      <Link href={`/deal/${encodeURIComponent(d.id)}`} className={imageClass}>
        {d.product.imageUrl ? (
          <Image src={d.product.imageUrl} alt={d.product.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No image</div>
        )}
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ProviderBadge provider={props.provider} />
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${urgencyTone(d.status)}`}>
            <CountdownTimer expiresAtMs={new Date(d.expiresAt as any).getTime()} labelPrefix="Ends in" />
          </span>
          {pct != null && (
            <div className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              {pct}% off
            </div>
          )}
        </div>

        <Link
          href={`/deal/${encodeURIComponent(d.id)}`}
          className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950 group-hover:text-slate-900"
        >
          {d.product.title}
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <div className="text-lg font-semibold text-slate-900">{formatMoney(d.currentPriceCents, d.currency)}</div>
          {d.oldPriceCents != null && d.oldPriceCents > d.currentPriceCents && (
            <div className="text-sm text-slate-500 line-through">{formatMoney(d.oldPriceCents, d.currency)}</div>
          )}
        </div>

        <div className="mt-3">
          <TrackedLink
            href={props.outboundUrl}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="mt-3 w-full rounded-lg bg-blue-600 text-white font-medium py-2 px-4 hover:bg-blue-700 transition-colors inline-flex items-center justify-center"
            track={{
              event: 'outbound_affiliate_click',
              section: props.section,
              asin: d.product.asin,
              dealId: d.id,
              dealStatus: d.status,
              provider: props.provider,
            }}
          >
            View Deal
          </TrackedLink>
          {shouldShowDisclosure(props.outboundUrl) ? (
            <div className="mt-2 text-[11px] text-slate-500">
              As an affiliate, we may earn from qualifying purchases.{' '}
              <Link href="/affiliate-disclosure" className="underline hover:text-slate-700">
                Learn more
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

