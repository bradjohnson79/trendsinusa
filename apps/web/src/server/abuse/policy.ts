import 'server-only';

import type { NextRequest } from 'next/server';
import { getCurrentSite } from '@/src/server/site';

export async function isProviderAllowedForSite(provider: string): Promise<boolean> {
  // Provider boundary = site allowlist. This is a licensing-safe constraint:
  // licensees can configure priorities, but cannot use providers not listed.
  const site = await getCurrentSite();
  const allowed = site?.affiliatePriorities?.map((p) => p.toLowerCase()) ?? ['amazon'];
  return allowed.includes(provider.toLowerCase());
}

export async function isRequestAllowed(_req: NextRequest): Promise<boolean> {
  // Placeholder hook for future abuse prevention (blocklists, captcha, etc).
  // Keep permissive by default.
  void _req;
  return true;
}

