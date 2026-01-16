import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getPartnerByKey } from '@trendsinusa/shared';
import { recordInvalidPartnerTokenAttempt } from '@/src/server/partners/governance';

export async function requirePartner(req: NextRequest, partnerKey: string) {
  const partner = await getPartnerByKey(partnerKey);
  if (!partner || !partner.enabled) return { ok: false as const, status: 404 as const };

  const token = req.headers.get('x-partner-token') ?? req.nextUrl.searchParams.get('token') ?? '';
  const expected = process.env[partner.tokenEnvVar] ?? '';
  if (!expected) return { ok: false as const, status: 503 as const };

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    void recordInvalidPartnerTokenAttempt(partner.key);
    return { ok: false as const, status: 401 as const };
  }
  if (!timingSafeEqual(a, b)) {
    void recordInvalidPartnerTokenAttempt(partner.key);
    return { ok: false as const, status: 401 as const };
  }

  return { ok: true as const, partner };
}

export function requireScope(partner: { scopes: string[] }, scope: string): { ok: true } | { ok: false; status: 404 } {
  // Return 404 to avoid endpoint discovery.
  if (!partner.scopes.includes(scope)) return { ok: false, status: 404 };
  return { ok: true };
}

