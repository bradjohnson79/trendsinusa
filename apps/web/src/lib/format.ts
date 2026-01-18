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

