'use server';

import { writeFile } from 'node:fs/promises';
import { revalidatePath } from 'next/cache';

import { readSitesConfig } from '@trendsinusa/shared';

function splitList(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const ALLOWED_LAYOUT = new Set(['premium', 'sponsored', 'live', 'trending', 'banners']);
const ALLOWED_PREMIUM = new Set(['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED']);

function toLayoutKeys(xs: string[]): Array<'premium' | 'sponsored' | 'live' | 'trending' | 'banners'> {
  return xs.filter((x) => ALLOWED_LAYOUT.has(x)) as Array<'premium' | 'sponsored' | 'live' | 'trending' | 'banners'>;
}

function toPremiumTypes(xs: string[]): Array<'SPOTLIGHT' | 'EDITORS_PICK' | 'FEATURED'> {
  return xs.filter((x) => ALLOWED_PREMIUM.has(x)) as Array<'SPOTLIGHT' | 'EDITORS_PICK' | 'FEATURED'>;
}

export async function updateSiteOverrides(formData: FormData) {
  const key = String(formData.get('key') ?? '').trim();
  if (!key) return;

  const heroTone = String(formData.get('heroTone') ?? 'neutral');
  const homepageLayoutRaw = String(formData.get('homepageLayout') ?? '').trim();
  const categoryEmphasisRaw = String(formData.get('categoryEmphasis') ?? '').trim();

  const premiumLimitRaw = String(formData.get('premiumLimit') ?? '').trim();
  const premiumLimit = premiumLimitRaw ? Number(premiumLimitRaw) : 3;

  const eligibleTypes = splitList(String(formData.get('eligibleTypes') ?? 'SPOTLIGHT,EDITORS_PICK,FEATURED'));
  const order = splitList(String(formData.get('order') ?? 'SPOTLIGHT,EDITORS_PICK,FEATURED'));

  const homepageLayout = homepageLayoutRaw ? toLayoutKeys(splitList(homepageLayoutRaw)) : [];
  const categoryEmphasis = categoryEmphasisRaw ? splitList(categoryEmphasisRaw) : [];
  const eligible = toPremiumTypes(eligibleTypes);
  const ordered = toPremiumTypes(order);

  const { path, config } = await readSitesConfig();
  const sites = config.sites.map((s) => {
    if (s.key !== key) return s;
    return {
      ...s,
      overrides: {
        ...s.overrides,
        heroTone: heroTone === 'conservative' || heroTone === 'energetic' ? heroTone : 'neutral',
        homepageLayout: homepageLayout.length ? homepageLayout : s.overrides.homepageLayout,
        categoryEmphasis,
        featuredPlacementRules: {
          ...s.overrides.featuredPlacementRules,
          premiumLimit: Number.isFinite(premiumLimit) ? Math.max(0, Math.min(12, premiumLimit)) : s.overrides.featuredPlacementRules.premiumLimit,
          eligibleTypes: eligible.length ? eligible : s.overrides.featuredPlacementRules.eligibleTypes,
          order: ordered.length ? ordered : s.overrides.featuredPlacementRules.order,
        },
      },
    };
  });

  await writeFile(path, JSON.stringify({ ...config, sites }, null, 2) + '\n', 'utf8');
  revalidatePath(`/admin/sites/${encodeURIComponent(key)}`);
  revalidatePath('/admin/sites');
}

