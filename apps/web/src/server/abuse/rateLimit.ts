import 'server-only';

import type { NextRequest } from 'next/server';

type Bucket = { count: number; resetAtMs: number };

// Simple in-memory fixed-window limiter. Suitable as a *hook*; for multi-instance/serverless,
// replace with a shared store (Redis, Upstash, etc).
const buckets = new Map<string, Bucket>();

function nowMs() {
  return Date.now();
}

function cleanup(maxEntries: number) {
  if (buckets.size <= maxEntries) return;
  const entries = Array.from(buckets.entries());
  entries.sort((a, b) => a[1].resetAtMs - b[1].resetAtMs);
  for (let i = 0; i < entries.length - maxEntries; i += 1) {
    buckets.delete(entries[i]![0]);
  }
}

export function requestFingerprint(req: NextRequest): string {
  // Prefer platform-provided IP header; fallback to user-agent only.
  const xf = req.headers.get('x-forwarded-for') ?? '';
  const ip = xf.split(',')[0]?.trim() ?? '';
  const ua = req.headers.get('user-agent') ?? '';
  return `${ip || 'noip'}|${ua.slice(0, 80) || 'noua'}`;
}

export function rateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const t = nowMs();
  const b = buckets.get(params.key);
  if (!b || t >= b.resetAtMs) {
    buckets.set(params.key, { count: 1, resetAtMs: t + params.windowMs });
    cleanup(5000);
    return { ok: true };
  }

  if (b.count >= params.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((b.resetAtMs - t) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  b.count += 1;
  buckets.set(params.key, b);
  return { ok: true };
}

