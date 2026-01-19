export function formatMoney(cents: number, currency: string) {
  const amount = cents / 100;
  try {
    const locale =
      currency === 'USD'
        ? 'en-US'
        : currency === 'CAD'
          ? 'en-CA'
          : currency === 'GBP'
            ? 'en-GB'
            : currency === 'AUD'
              ? 'en-AU'
              : 'en';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function relativeTimeFrom(date: Date, now = new Date()): string {
  const ms = now.getTime() - date.getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function countdownFromIso(expiresAtIso: string | null | undefined, now = new Date()): null | {
  label: string;
  state: 'normal' | 'urgent' | 'expired';
  remainingMs: number;
} {
  if (!expiresAtIso) return null;
  const exp = new Date(expiresAtIso);
  if (Number.isNaN(exp.getTime())) return null;
  const diff = exp.getTime() - now.getTime();
  if (diff <= 0) return { label: 'Expired', state: 'expired', remainingMs: 0 };
  const mins = Math.max(0, Math.floor(diff / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const state: 'normal' | 'urgent' = diff < 60 * 60 * 1000 ? 'urgent' : 'normal';
  return { label: `Expires in ${h}h ${m}m`, state, remainingMs: diff };
}
