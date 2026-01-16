import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const brandingSchema = z.object({
  primaryColor: z.string().default('#0f172a'),
  accentColor: z.string().default('#2563eb'),
  logoUrl: z.string().url().nullable().default(null),
});

const homepageSectionSchema = z.enum(['premium', 'sponsored', 'live', 'trending', 'banners', 'geo_topics', 'topics']);

const featuredPlacementRulesSchema = z.object({
  // Max premium slots shown on homepage/category surfaces.
  premiumLimit: z.number().int().min(0).max(12).default(3),
  // Which placement types are eligible for "premium" rendering.
  eligibleTypes: z.array(z.enum(['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'])).default(['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED']),
  // Preferred ordering for labels (left-to-right / top priority).
  order: z.array(z.enum(['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'])).default(['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED']),
});

const overridesSchema = z.object({
  homepageLayout: z.array(homepageSectionSchema).default(['premium', 'sponsored', 'live', 'trending', 'banners']),
  heroTone: z.enum(['conservative', 'neutral', 'energetic']).default('neutral'),
  categoryEmphasis: z.array(z.string()).default([]),
  featuredPlacementRules: featuredPlacementRulesSchema.default({
    premiumLimit: 3,
    eligibleTypes: ['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'],
    order: ['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'],
  }),
});

const siteSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  enabled: z.boolean().default(true),
  defaultCategories: z.array(z.string()).default([]),
  affiliatePriorities: z.array(z.enum(['AMAZON', 'WALMART', 'TARGET'])).default(['AMAZON']),
  branding: brandingSchema.default({ primaryColor: '#0f172a', accentColor: '#2563eb', logoUrl: null }),
  overrides: overridesSchema.default({
    homepageLayout: ['premium', 'sponsored', 'live', 'trending', 'banners'],
    heroTone: 'neutral',
    categoryEmphasis: [],
    featuredPlacementRules: { premiumLimit: 3, eligibleTypes: ['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'], order: ['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'] },
  }),
});

const sitesFileSchema = z.object({
  version: z.literal(1),
  sites: z.array(siteSchema),
});

export type SiteConfig = z.infer<typeof siteSchema>;
export type SitesConfigFile = z.infer<typeof sitesFileSchema>;

function candidateSitesPaths(cwd: string): string[] {
  const envPath = process.env.TRENDSINUSA_SITES_PATH;
  const cands = [
    envPath,
    path.join(cwd, 'config', 'sites.json'),
    path.join(cwd, '..', 'config', 'sites.json'),
    path.join(cwd, '..', '..', 'config', 'sites.json'),
  ].filter(Boolean) as string[];
  return cands;
}

export async function readSitesConfig(): Promise<{ path: string; config: SitesConfigFile }> {
  const cwd = process.cwd();
  const candidates = candidateSitesPaths(cwd);

  let lastErr: unknown = null;
  for (const p of candidates) {
    try {
      const raw = await readFile(p, 'utf8');
      const json = JSON.parse(raw) as unknown;
      const parsed = sitesFileSchema.parse(json);
      return { path: p, config: parsed };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  throw new Error(
    `Unable to load sites config. Tried:\n- ${candidates.join('\n- ')}\n\nLast error: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

export async function getSiteByKey(key: string): Promise<SiteConfig | null> {
  const { config } = await readSitesConfig();
  return config.sites.find((s) => s.key === key) ?? null;
}

