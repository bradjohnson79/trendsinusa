import type { AffiliateProvider } from '@prisma/client';

function label(provider: AffiliateProvider | string) {
  const p = String(provider).toUpperCase();
  if (p === 'AMAZON') return 'Amazon';
  if (p === 'WALMART') return 'Walmart';
  if (p === 'TARGET') return 'Target';
  if (p === 'BESTBUY' || p === 'BEST_BUY') return 'Best Buy';
  return p;
}

export function ProviderBadge(props: { provider: AffiliateProvider | string }) {
  const p = String(props.provider).toUpperCase();
  const tone =
    p === 'AMAZON'
      ? 'bg-slate-900 text-white'
      : p === 'WALMART'
        ? 'bg-blue-600 text-white'
        : p === 'TARGET'
          ? 'bg-red-600 text-white'
          : 'bg-slate-700 text-white';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {label(props.provider)}
    </span>
  );
}

