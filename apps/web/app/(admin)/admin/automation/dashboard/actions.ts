'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getServerEnv } from '@trendsinusa/shared';
import { requestCategoryRegenerate, requestHeroRegenerate, setImageGenEnabled } from '@/src/server/admin/automationConfig';

async function getAdminSelectedSiteKey(): Promise<string> {
  const env = getServerEnv();
  const store = await cookies();
  return store.get('tui_admin_site')?.value ?? env.SITE_KEY;
}

export async function saveImageGenEnabled(formData: FormData) {
  const siteKey = await getAdminSelectedSiteKey();
  const enabled = formData.get('imageGenEnabled') === 'on';
  await setImageGenEnabled(siteKey, enabled);
  revalidatePath('/admin/automation/dashboard');
}

export async function queueHeroRegenerate() {
  const siteKey = await getAdminSelectedSiteKey();
  await requestHeroRegenerate(siteKey);
  revalidatePath('/admin/automation/dashboard');
}

export async function queueCategoryRegenerate() {
  const siteKey = await getAdminSelectedSiteKey();
  await requestCategoryRegenerate(siteKey);
  revalidatePath('/admin/automation/dashboard');
}

