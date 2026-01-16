import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const partnerSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean().default(false),
  // Which site this partner operates against (used for routing + attribution).
  siteKey: z.string().min(1),

  // Kill switch + operational constraints
  scopes: z
    .array(z.enum(['feed', 'categories', 'trends', 'billing', 'cobranded_page']))
    .default(['feed']),
  rateLimitPerMinute: z.number().int().min(1).max(600).default(120),
  maxLimit: z.number().int().min(1).max(200).default(50),

  // Visibility tier for aggregated intelligence outputs (never raw logs).
  tier: z.enum(['basic', 'pro']).default('basic'),

  // Monetization is preview-only unless explicitly activated by operators.
  monetization: z
    .object({
      model: z.enum(['access', 'usage', 'revshare']).default('revshare'),
      // Platform take-rate in basis points (bps). 2000 = 20%.
      // Governance cap: never exceed 30% (avoid rent-seeking).
      platformFeeBps: z.number().int().min(0).max(3000).default(2000),
      // Optional usage pricing (only counts when value is delivered; never raw logs).
      // Example: $2.00 per 1,000 partner-attributed affiliate clicks.
      // Governance cap: keep usage pricing modest and predictable.
      usageCentsPer1000Clicks: z.number().int().min(0).max(500).default(0),
      freeClicksPerMonth: z.number().int().min(0).max(10_000_000).default(0),
      currency: z.enum(['USD']).default('USD'),
      notes: z.string().max(500).optional(),
    })
    .default({
      model: 'revshare',
      platformFeeBps: 2000,
      usageCentsPer1000Clicks: 0,
      freeClicksPerMonth: 0,
      currency: 'USD',
    }),

  // Secret name to read from environment; value is never stored in config.
  tokenEnvVar: z.string().min(1),

  branding: z
    .object({
      name: z.string().min(1),
      primaryColor: z.string().default('#0f172a'),
      logoUrl: z.string().url().nullable().default(null),
    })
    .default({ name: 'Partner', primaryColor: '#0f172a', logoUrl: null }),
});

const partnersFileSchema = z.object({
  version: z.literal(1),
  partners: z.array(partnerSchema),
});

export type PartnerConfig = z.infer<typeof partnerSchema>;
export type PartnersConfigFile = z.infer<typeof partnersFileSchema>;

function candidatePartnersPaths(cwd: string): string[] {
  const envPath = process.env.TRENDSINUSA_PARTNERS_PATH;
  return [
    envPath,
    path.join(cwd, 'config', 'partners.json'),
    path.join(cwd, '..', 'config', 'partners.json'),
    path.join(cwd, '..', '..', 'config', 'partners.json'),
  ].filter(Boolean) as string[];
}

export async function readPartnersConfig(): Promise<{ path: string; config: PartnersConfigFile }> {
  const cwd = process.cwd();
  const candidates = candidatePartnersPaths(cwd);
  let lastErr: unknown = null;
  for (const p of candidates) {
    try {
      const raw = await readFile(p, 'utf8');
      const json = JSON.parse(raw) as unknown;
      const parsed = partnersFileSchema.parse(json);
      return { path: p, config: parsed };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw new Error(
    `Unable to load partners config. Tried:\n- ${candidates.join('\n- ')}\n\nLast error: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

export async function getPartnerByKey(key: string): Promise<PartnerConfig | null> {
  const { config } = await readPartnersConfig();
  return config.partners.find((p) => p.key === key) ?? null;
}

