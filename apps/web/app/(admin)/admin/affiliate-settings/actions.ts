'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import type { AffiliateProvider } from '@prisma/client';
import { upsertAffiliateConfigUS } from '@/src/server/affiliate/config';
import { prisma } from '@/src/server/prisma';
import { getServerEnv } from '@trendsinusa/shared';

async function getAdminSelectedSiteKey(): Promise<string> {
  const env = getServerEnv();
  const store = await cookies();
  return store.get('tui_admin_site')?.value ?? env.SITE_KEY;
}

export async function saveAffiliateSettings(formData: FormData) {
  const siteKey = await getAdminSelectedSiteKey();
  const enabled = formData.get('enabled') === 'on';
  const associateTagRaw = String(formData.get('associateTag') ?? '').trim();
  const associateTag = associateTagRaw.length ? associateTagRaw : null;

  await upsertAffiliateConfigUS({ siteKey, enabled, associateTag });
  revalidatePath('/admin/affiliate-settings');
}

export async function saveProviderConfig(formData: FormData) {
  const siteKey = await getAdminSelectedSiteKey();
  const providerRaw = String(formData.get('provider') ?? '').toUpperCase();
  const allowed: ReadonlySet<AffiliateProvider> = new Set(['AMAZON', 'WALMART', 'TARGET']);
  if (!allowed.has(providerRaw as AffiliateProvider)) return;
  const provider = providerRaw as AffiliateProvider;
  const enabled = formData.get('providerEnabled') === 'on';
  const affiliateIdRaw = String(formData.get('affiliateId') ?? '').trim();
  const affiliateId = affiliateIdRaw.length ? affiliateIdRaw : null;
  const priorityRaw = String(formData.get('priority') ?? '').trim();
  const priority = priorityRaw.length ? Number(priorityRaw) : 100;
  const linkTemplateRaw = String(formData.get('linkTemplate') ?? '').trim();
  const linkTemplate = linkTemplateRaw.length ? linkTemplateRaw : null;

  await prisma.affiliateProviderConfig.upsert({
    where: { siteKey_provider: { siteKey, provider } },
    create: {
      siteKey,
      provider,
      enabled,
      affiliateId,
      priority: Number.isFinite(priority) ? priority : 100,
      linkTemplate,
    },
    update: {
      enabled,
      affiliateId,
      priority: Number.isFinite(priority) ? priority : 100,
      linkTemplate,
    },
  });

  revalidatePath('/admin/affiliate-settings');
}

