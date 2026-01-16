import Image from 'next/image';
import Link from 'next/link';

import type { Deal, Product } from '@prisma/client';

import { AffiliateCta } from './AffiliateCta';
import type { AffiliateLinkResult } from '@trendsinusa/shared';
import { TrackImpression } from './TrackImpression';
import { formatMoney, relativeTimeFrom, timeUntil } from '@/src/lib/format';

function computeDiscountPercent(deal: Deal): number | null {
  if (deal.discountPercent != null) return deal.discountPercent;
  if (deal.oldPriceCents && deal.oldPriceCents > 0) {
    return Math.round(((deal.oldPriceCents - deal.currentPriceCents) / deal.oldPriceCents) * 100);
  }
  return null;
}

function expiryLabel(expiresAt: Date, status: Deal['status']) {
  if (status === 'EXPIRED') return 'Expired';
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const minutes = Math.ceil(ms / 60000);
  if (minutes <= 60) return `Ends ${timeUntil(expiresAt)}`;
  if (minutes <= 6 * 60) return `Ends ${timeUntil(expiresAt)}`;
  if (minutes <= 24 * 60) return `Ends ${timeUntil(expiresAt)}`;
  return `Ends ${timeUntil(expiresAt)}`;
}

export function DealCard(props: {
  deal: Deal & { product: Product };
  affiliate: AffiliateLinkResult;
  section: string;
  ctaVariant: string;
  badgeVariant: string;
}) {
  const { deal } = props;
  const product = deal.product;
  const discount = computeDiscountPercent(deal);
  const savings =
    deal.oldPriceCents != null && deal.oldPriceCents > deal.currentPriceCents
      ? deal.oldPriceCents - deal.currentPriceCents
      : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <TrackImpression
        payload={{
          event: 'impression',
          section: props.section,
          asin: product.asin,
          dealId: deal.id,
          dealStatus: deal.status,
          ctaVariant: props.ctaVariant,
          badgeVariant: props.badgeVariant,
        }}
      />
      <div className="flex gap-4">
        <Link
          href={`/p/${encodeURIComponent(product.asin)}`}
          className="relative h-20 w-20 overflow-hidden rounded-md bg-slate-100"
        >
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.title} fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
              No image
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/p/${encodeURIComponent(product.asin)}`}
            className="truncate text-sm font-medium text-slate-900 hover:underline"
          >
            {product.title}
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <div className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              {props.badgeVariant === 'hot' ? 'HOT' : 'ENDING SOON'}
            </div>
            <div className="text-xs text-slate-600">{expiryLabel(deal.expiresAt, deal.status)}</div>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <div className="text-lg font-semibold text-slate-900">
              {formatMoney(deal.currentPriceCents, deal.currency)}
            </div>
            {deal.oldPriceCents != null && (
              <div className="text-sm text-slate-500">
                <span className="mr-1">Was</span>
                <span className="line-through">{formatMoney(deal.oldPriceCents, deal.currency)}</span>
              </div>
            )}
            {discount != null && (
              <div className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                {discount}% off
              </div>
            )}
            {savings != null && (
              <div className="text-xs text-slate-600">Save {formatMoney(savings, deal.currency)}</div>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Updated {relativeTimeFrom(deal.updatedAt)} · Expires {deal.expiresAt.toISOString()}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-center text-xs text-slate-600">
          {props.ctaVariant === 'view_deal' ? 'View Deal' : 'See Price'}
        </div>
        <div className="mt-2">
          <AffiliateCta result={props.affiliate} />
        </div>
      </div>
    </div>
  );
}

