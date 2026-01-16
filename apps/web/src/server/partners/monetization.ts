import 'server-only';

import { getServerEnv } from '@trendsinusa/shared';
import { getSignals } from '@/src/server/signals/core';

export type MonetizationModel = 'access' | 'usage' | 'revshare';

export type PartnerStatementParams = {
  days: number;
  partner: {
    key: string;
    siteKey: string;
    tier: 'basic' | 'pro';
    monetization: {
      model: MonetizationModel;
      platformFeeBps: number;
      usageCentsPer1000Clicks: number;
      freeClicksPerMonth: number;
      currency: 'USD';
    };
  };
};

function bpsOf(amountCents: number, bps: number): number {
  return Math.floor((amountCents * bps) / 10_000);
}

export async function getPartnerStatement(params: PartnerStatementParams) {
  const env = getServerEnv();
  const mode = env.ECOSYSTEM_BILLING_MODE;

  const signals = await getSignals({
    days: params.days,
    partnerKey: params.partner.key,
    siteKey: params.partner.siteKey,
    tier: params.partner.tier,
  });

  const gross = signals.totals.estRevenueCents;
  const clicks = signals.totals.clicks;
  const imps = signals.totals.impressions;

  const revshare = (() => {
    const platformFee = bpsOf(gross, params.partner.monetization.platformFeeBps);
    const partnerNet = Math.max(0, gross - platformFee);
    return {
      model: 'revshare' as const,
      platformFeeBps: params.partner.monetization.platformFeeBps,
      grossEstRevenueCents: gross,
      platformRevenueCents: platformFee,
      partnerNetRevenueCents: partnerNet,
    };
  })();

  const usage = (() => {
    // Usage-based is value-delivery aligned: it only charges per partner-attributed affiliate clicks.
    // If pricing is unset, this evaluates to 0 (preview-only).
    const free = params.partner.monetization.freeClicksPerMonth;
    const billableClicks = Math.max(0, clicks - free);
    const fee =
      params.partner.monetization.usageCentsPer1000Clicks > 0
        ? Math.floor((billableClicks * params.partner.monetization.usageCentsPer1000Clicks) / 1000)
        : 0;
    return {
      model: 'usage' as const,
      usageCentsPer1000Clicks: params.partner.monetization.usageCentsPer1000Clicks,
      freeClicksPerMonth: free,
      billableClicks,
      platformRevenueCents: fee,
      partnerNetRevenueCents: Math.max(0, gross - fee),
      grossEstRevenueCents: gross,
    };
  })();

  const access = (() => {
    // Access-based model is purely tiered access to APIs/features; pricing is intentionally 0 by default.
    // If operators later enable pricing, it should remain value-delivery aligned (e.g. only after revenue thresholds).
    return {
      model: 'access' as const,
      tier: params.partner.tier,
      platformRevenueCents: 0,
      partnerNetRevenueCents: gross,
      grossEstRevenueCents: gross,
    };
  })();

  return {
    meta: {
      mode,
      partner: { key: params.partner.key, siteKey: params.partner.siteKey, tier: params.partner.tier },
      windowDays: params.days,
      since: signals.since.toISOString(),
      generatedAt: new Date().toISOString(),
      currency: params.partner.monetization.currency,
      notes: [
        'All values are aggregated and privacy-safe. No raw user data.',
        'Revenue is estimated from EPC assumptions; treat as directional unless reconciled with provider reports.',
        'Billing mode defaults to off; outputs are for preview unless explicitly activated by operators.',
      ],
    },
    usage: { impressions: imps, clicks },
    signals: {
      ctr: signals.totals.ctr,
      outputs: signals.outputs,
    },
    models: { access, usage, revshare },
    activeModel: params.partner.monetization.model,
  };
}

