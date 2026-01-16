import Image from 'next/image';
import Link from 'next/link';

import type { Product } from '@prisma/client';

export function ProductCard(props: { product: Product }) {
  const p = props.product;
  return (
    <Link
      href={`/product/${encodeURIComponent(p.asin)}`}
      className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {p.imageUrl ? (
          <Image src={p.imageUrl} alt={p.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">No image</div>
        )}
      </div>
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm font-semibold text-slate-900">{p.title}</div>
        {p.categoryOverride || p.category ? (
          <div className="mt-1 text-xs text-slate-600">{p.categoryOverride ?? p.category}</div>
        ) : null}
      </div>
    </Link>
  );
}

