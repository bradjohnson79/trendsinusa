import 'server-only';

import { prisma } from '../prisma';

export async function getAffiliateConfigUS(siteKey: string) {
  try {
    return await prisma.affiliateConfig.findUnique({
      where: { siteKey_region: { siteKey, region: 'US' } },
    });
  } catch {
    // First-run case: migrations not applied yet.
    return null;
  }
}

export async function upsertAffiliateConfigUS(params: { siteKey: string; enabled: boolean; associateTag: string | null }) {
  return await prisma.affiliateConfig.upsert({
    where: { siteKey_region: { siteKey: params.siteKey, region: 'US' } },
    create: {
      siteKey: params.siteKey,
      region: 'US',
      enabled: params.enabled,
      associateTag: params.associateTag,
    },
    update: {
      enabled: params.enabled,
      associateTag: params.associateTag,
    },
  });
}

