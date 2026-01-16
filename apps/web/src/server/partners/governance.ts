import 'server-only';

import type { NextRequest } from 'next/server';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/src/server/prisma';
import { rateLimit } from '@/src/server/abuse/rateLimit';

export type GovernanceAction = 'allow' | 'warn' | 'throttle' | 'suspend' | 'terminate';
export type GovernanceRule =
  | 'token_invalid'
  | 'over_limit_requested'
  | 'scope_missing'
  | 'billing_disabled'
  | 'throttled_due_to_violations'
  | 'suspended_due_to_violations';

const GOV_PREFIX = 'gov:';

function govMessage(params: {
  partnerKey: string;
  rule: GovernanceRule;
  action: GovernanceAction;
  details?: string;
}): string {
  const parts = [`${GOV_PREFIX}partner=${params.partnerKey}`, `rule=${params.rule}`, `action=${params.action}`];
  if (params.details) parts.push(`details=${params.details}`);
  return parts.join(' ');
}

async function createGovAlertOnce(params: {
  partnerKey: string;
  rule: GovernanceRule;
  action: GovernanceAction;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  details?: string;
  dedupeWindowMinutes: number;
}) {
  const msg = govMessage({
    partnerKey: params.partnerKey,
    rule: params.rule,
    action: params.action,
    ...(params.details ? { details: params.details } : {}),
  });
  const since = new Date(Date.now() - params.dedupeWindowMinutes * 60 * 1000);
  const existing = await prisma.systemAlert.findFirst({
    where: {
      type: 'SYSTEM',
      createdAt: { gte: since },
      message: msg,
      resolvedAt: null,
    },
    select: { id: true },
  });
  if (existing) return;
  await prisma.systemAlert.create({
    data: {
      type: 'SYSTEM',
      severity: params.severity,
      noisy: false,
      message: msg,
    },
  });
}

export type PartnerForGovernance = {
  key: string;
  enabled: boolean;
  scopes: string[];
  rateLimitPerMinute: number;
  maxLimit: number;
};

type EnforcementState = {
  action: GovernanceAction;
  openViolations: number;
  openCritical: number;
};

const getEnforcementStateCached = unstable_cache(
  async (partnerKey: string): Promise<EnforcementState> => {
    const alerts = await prisma.systemAlert.findMany({
      where: {
        type: 'SYSTEM',
        resolvedAt: null,
        message: { startsWith: `${GOV_PREFIX}partner=${partnerKey} ` },
      },
      select: { severity: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });

    const openViolations = alerts.length;
    const openCritical = alerts.filter((a) => a.severity === 'CRITICAL').length;

    // Explicit, non-ambiguous escalation:
    // - terminate: >= 15 open violations OR any critical >= 3
    // - suspend:   >= 10 open violations OR any critical >= 2
    // - throttle:  >= 5 open violations
    // - warn:      >= 2 open violations
    // - allow:     otherwise
    const action: GovernanceAction =
      openViolations >= 15 || openCritical >= 3
        ? 'terminate'
        : openViolations >= 10 || openCritical >= 2
          ? 'suspend'
          : openViolations >= 5
            ? 'throttle'
            : openViolations >= 2
              ? 'warn'
              : 'allow';

    return { action, openViolations, openCritical };
  },
  ['gov:enforcement'],
  { revalidate: 60 },
);

export async function getPartnerEnforcementState(partnerKey: string): Promise<EnforcementState> {
  try {
    return await getEnforcementStateCached(partnerKey);
  } catch {
    // Fail open (don't take partners down due to governance DB query issues)
    return { action: 'allow', openViolations: 0, openCritical: 0 };
  }
}

export async function enforcePartnerGovernance(params: {
  req: NextRequest;
  partner: PartnerForGovernance;
  endpointKey: string;
}): Promise<{ ok: true; headers?: Record<string, string> } | { ok: false; status: 404 | 429; headers?: Record<string, string> }> {
  const state = await getPartnerEnforcementState(params.partner.key);

  if (state.action === 'suspend' || state.action === 'terminate') {
    await createGovAlertOnce({
      partnerKey: params.partner.key,
      rule: 'suspended_due_to_violations',
      action: state.action,
      severity: 'CRITICAL',
      details: `${params.endpointKey} open=${state.openViolations} critical=${state.openCritical}`,
      dedupeWindowMinutes: 30,
    });
    // 404 to avoid endpoint discovery.
    return { ok: false, status: 404 };
  }

  if (state.action === 'throttle') {
    // Progressive throttling via an additional limiter (no config edits).
    const limit = Math.max(5, Math.floor(params.partner.rateLimitPerMinute * 0.25));
    const rl = rateLimit({ key: `gov:throttle:${params.partner.key}:${params.endpointKey}`, limit, windowMs: 60_000 });
    if (!rl.ok) {
      await createGovAlertOnce({
        partnerKey: params.partner.key,
        rule: 'throttled_due_to_violations',
        action: 'throttle',
        severity: 'ERROR',
        details: `${params.endpointKey} limit=${limit}/min`,
        dedupeWindowMinutes: 10,
      });
      return { ok: false, status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } };
    }
    return { ok: true, headers: { 'x-governance': 'throttle' } };
  }

  if (state.action === 'warn') {
    // Headers are internal-only hints; no behavior change.
    return { ok: true, headers: { 'x-governance': 'warn' } };
  }

  return { ok: true };
}

export async function recordInvalidPartnerTokenAttempt(partnerKey: string) {
  // Avoid storing IP/user-agent. Use only an in-memory limiter to detect repeated failures.
  const rl = rateLimit({ key: `gov:badtoken:${partnerKey}`, limit: 20, windowMs: 60_000 });
  if (rl.ok) return;
  await createGovAlertOnce({
    partnerKey,
    rule: 'token_invalid',
    action: 'warn',
    severity: 'WARNING',
    details: 'Repeated invalid token attempts (rate-limited)',
    dedupeWindowMinutes: 30,
  });
}

export async function recordOverLimitRequested(partnerKey: string, requested: number, max: number, endpointKey: string) {
  await createGovAlertOnce({
    partnerKey,
    rule: 'over_limit_requested',
    action: 'warn',
    severity: 'INFO',
    details: `${endpointKey} requested=${requested} max=${max}`,
    dedupeWindowMinutes: 60,
  });
}

