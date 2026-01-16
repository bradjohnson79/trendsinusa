'use server';

import { writeFile } from 'node:fs/promises';

import { readSitesConfig } from '@trendsinusa/shared';
import type { SiteConfig } from '@trendsinusa/shared';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function setAdminSite(formData: FormData) {
  const key = String(formData.get('key') ?? '').trim();
  if (!key) return;
  const store = await cookies();
  store.set('tui_admin_site', key, { httpOnly: true, sameSite: 'lax', path: '/admin' });
  revalidatePath('/admin/sites');
}

export async function toggleSiteEnabled(formData: FormData) {
  const key = String(formData.get('key') ?? '').trim();
  if (!key) return;

  const { path, config } = await readSitesConfig();
  const sites = config.sites.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s));

  await writeFile(path, JSON.stringify({ ...config, sites }, null, 2) + '\n', 'utf8');
  revalidatePath('/admin/sites');
}

export async function createSite(formData: FormData) {
  const key = String(formData.get('key') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const domain = String(formData.get('domain') ?? '').trim();
  const categoriesRaw = String(formData.get('defaultCategories') ?? '').trim();
  const enabled = formData.get('enabled') === 'on';

  if (!key || !name || !domain) return;

  const defaultCategories = categoriesRaw
    ? categoriesRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const next: SiteConfig = {
    key,
    name,
    domain,
    enabled,
    defaultCategories,
    affiliatePriorities: ['AMAZON'],
    branding: { primaryColor: '#0f172a', accentColor: '#2563eb', logoUrl: null },
    overrides: {
      homepageLayout: ['premium', 'sponsored', 'live', 'trending', 'banners'],
      heroTone: 'neutral',
      categoryEmphasis: [],
      featuredPlacementRules: {
        premiumLimit: 3,
        eligibleTypes: ['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'],
        order: ['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'],
      },
    },
  };

  const { path, config } = await readSitesConfig();
  if (config.sites.some((s) => s.key === key)) return;

  const sites = [...config.sites, next];
  await writeFile(path, JSON.stringify({ ...config, sites }, null, 2) + '\n', 'utf8');
  revalidatePath('/admin/sites');
}

