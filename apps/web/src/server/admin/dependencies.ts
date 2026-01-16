import 'server-only';

import { prisma } from '@/src/server/prisma';
import { getAdminDbStatus } from '@/src/server/admin/dbStatus';
import { getOpsHealth } from '@/src/server/admin/health';
import { getServerEnv, readPartnersConfig } from '@trendsinusa/shared';

type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
type Issue = { severity: Severity; key: string; message: string };

type Meta = { event: string; partner: string; site: string; provider: string };
function parseReferrer(referrer: string | null): Meta {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    partner: sp.get('partner') ?? 'none',
    site: sp.get('site') ?? 'unknown',
    provider: (sp.get('provider') ?? 'amazon').toLowerCase(),
  };
}

export async function getDependencyHealthReport(params: { days: number }) {
  const env = getServerEnv();
  const [db, ops, partnersCfg] = await Promise.all([getAdminDbStatus(), getOpsHealth(), readPartnersConfig()]);

  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [affiliateUS, providerConfigs, aiFailures24h, events] = await Promise.all([
    prisma.affiliateConfig.findFirst({ where: { region: 'US' }, select: { enabled: true, associateTag: true, updatedAt: true } }),
    prisma.affiliateProviderConfig.findMany({ select: { provider: true, enabled: true, affiliateId: true, priority: true } }),
    prisma.aIActionLog.count({ where: { startedAt: { gte: since24h }, status: 'FAILURE' } }),
    prisma.clickEvent.findMany({
      where: { occurredAt: { gte: since } },
      select: { occurredAt: true, href: true, referrer: true },
      take: 100000,
      orderBy: { occurredAt: 'desc' },
    }),
  ]);

  // Concentration tracking (partner + revenue provider) using aggregated, referrer-encoded attribution.
  let totalPartnerClicks = 0;
  const partnerClicks = new Map<string, number>();
  const providerClicks = new Map<string, number>();
  const partnerSet = new Set(partnersCfg.config.partners.map((p) => p.key));

  for (const e of events) {
    const meta = parseReferrer(e.referrer);
    if (meta.event !== 'affiliate_click') continue;
    providerClicks.set(meta.provider, (providerClicks.get(meta.provider) ?? 0) + 1);
    if (!partnerSet.has(meta.partner)) continue;
    totalPartnerClicks += 1;
    partnerClicks.set(meta.partner, (partnerClicks.get(meta.partner) ?? 0) + 1);
  }

  const topPartner = Array.from(partnerClicks.entries())
    .sort((a, b) => b[1] - a[1])[0] ?? null;
  const topPartnerShare = topPartner && totalPartnerClicks > 0 ? topPartner[1] / totalPartnerClicks : 0;

  const topProvider = Array.from(providerClicks.entries())
    .sort((a, b) => b[1] - a[1])[0] ?? null;
  const totalClicks = Array.from(providerClicks.values()).reduce((a, b) => a + b, 0);
  const topProviderShare = topProvider && totalClicks > 0 ? topProvider[1] / totalClicks : 0;

  const issues: Issue[] = [];

  // Infrastructure: DB
  if (db.status !== 'ready') {
    issues.push({ severity: 'CRITICAL', key: 'db', message: `Database not ready: ${db.status}` });
  }

  // Data source: ingestion freshness (proxy)
  if (ops.lastIngestionAgeMinutes != null && ops.lastIngestionAgeMinutes > 120) {
    issues.push({ severity: 'WARNING', key: 'ingestion_freshness', message: `Ingestion looks stale (${ops.lastIngestionAgeMinutes}m since last run).` });
  }
  if (ops.ingestionFailures24h > 0) {
    issues.push({ severity: 'ERROR', key: 'ingestion_failures', message: `Ingestion failures in last 24h: ${ops.ingestionFailures24h}` });
  }

  // Tooling vendor: OpenAI (replaceability indicator)
  if (!env.OPENAI_API_KEY) {
    issues.push({ severity: 'INFO', key: 'openai', message: 'OPENAI_API_KEY not set. AI features will be unavailable (expected if AI not activated).' });
  }
  if (aiFailures24h > 0) {
    issues.push({ severity: 'WARNING', key: 'ai_failures', message: `AI failures in last 24h: ${aiFailures24h}` });
  }

  // Revenue provider: affiliate configuration
  if (!affiliateUS?.enabled || !affiliateUS.associateTag) {
    issues.push({
      severity: 'WARNING',
      key: 'affiliate_us',
      message: 'US affiliate linking is disabled or missing associate tag; outbound monetization will be blocked/degraded.',
    });
  }

  // Partner concentration (long-term control / substitution risk)
  if (topPartner && topPartnerShare >= 0.5) {
    issues.push({ severity: 'CRITICAL', key: 'partner_concentration', message: `Top partner concentration ≥50% (${topPartner[0]} at ${(topPartnerShare * 100).toFixed(0)}%).` });
  } else if (topPartner && topPartnerShare >= 0.4) {
    issues.push({ severity: 'ERROR', key: 'partner_concentration', message: `Top partner concentration ≥40% (${topPartner[0]} at ${(topPartnerShare * 100).toFixed(0)}%).` });
  } else if (topPartner && topPartnerShare >= 0.3) {
    issues.push({ severity: 'WARNING', key: 'partner_concentration', message: `Top partner concentration ≥30% (${topPartner[0]} at ${(topPartnerShare * 100).toFixed(0)}%).` });
  }

  // Revenue provider concentration
  if (topProvider && topProviderShare >= 0.85) {
    issues.push({ severity: 'WARNING', key: 'provider_concentration', message: `Top affiliate provider dominates clicks (${topProvider[0]} at ${(topProviderShare * 100).toFixed(0)}%).` });
  }

  return {
    generatedAt: new Date().toISOString(),
    window: { days: params.days, since: since.toISOString() },
    infra: { db },
    dataSources: { ingestion: ops },
    vendors: { openaiKeyPresent: !!env.OPENAI_API_KEY },
    revenueProviders: {
      affiliateUS,
      providerConfigs: providerConfigs.sort((a, b) => a.priority - b.priority),
      clickConcentration: {
        totalClicks,
        topProvider: topProvider ? { provider: topProvider[0], clicks: topProvider[1], share: topProviderShare } : null,
      },
    },
    partners: {
      configured: partnersCfg.config.partners.length,
      partnerClickConcentration: {
        totalPartnerClicks,
        topPartner: topPartner ? { partner: topPartner[0], clicks: topPartner[1], share: topPartnerShare } : null,
      },
    },
    issues,
  };
}

