'use client';

import { useEffect, useMemo, useState } from 'react';

function fmt(ms: number) {
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.floor(ms / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  if (h <= 0) return `${m}m ${s}s`;
  if (h < 48) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h`;
}

export function CountdownTimer(props: { expiresAt?: Date | string; expiresAtMs?: number; labelPrefix?: string }) {
  const [now, setNow] = useState<number | null>(null);
  const expires =
    typeof props.expiresAtMs === 'number'
      ? props.expiresAtMs
      : typeof props.expiresAt === 'string'
        ? Date.parse(props.expiresAt)
        : props.expiresAt
          ? props.expiresAt.getTime()
          : NaN;

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const text = useMemo(() => {
    if (now == null) return '—';
    return fmt(expires - now);
  }, [expires, now]);

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {props.labelPrefix ? `${props.labelPrefix} ${text}` : text}
    </span>
  );
}

