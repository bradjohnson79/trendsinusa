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

export function timeUntil(expiresAt: Date, now = new Date()): string {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.ceil(mins / 60);
  if (hrs <= 24) return `in ${hrs}h`;
  const days = Math.ceil(hrs / 24);
  return `in ${days}d`;
}

