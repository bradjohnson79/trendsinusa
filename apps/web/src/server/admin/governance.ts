import 'server-only';

import { prisma } from '@/src/server/prisma';
import { readPartnersConfig } from '@trendsinusa/shared';
import { getPartnerEnforcementState } from '@/src/server/partners/governance';

export async function getGovernanceReport(params: { limit: number }) {
  const { config } = await readPartnersConfig();
  const partnerKeys = config.partners.map((p) => p.key);

  const alerts = await prisma.systemAlert.findMany({
    where: { type: 'SYSTEM', message: { startsWith: 'gov:' } },
    orderBy: { createdAt: 'desc' },
    take: params.limit,
  });

  const states = await Promise.all(partnerKeys.map(async (k) => ({ key: k, state: await getPartnerEnforcementState(k) })));
  const byPartner = new Map(states.map((x) => [x.key, x.state] as const));

  return {
    partners: config.partners.map((p) => ({
      key: p.key,
      enabled: p.enabled,
      siteKey: p.siteKey,
      tier: p.tier ?? 'basic',
      action: byPartner.get(p.key)?.action ?? 'allow',
      openViolations: byPartner.get(p.key)?.openViolations ?? 0,
      openCritical: byPartner.get(p.key)?.openCritical ?? 0,
      scopes: p.scopes,
    })),
    alerts,
  };
}

