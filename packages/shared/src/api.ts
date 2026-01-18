import { z } from 'zod';

/**
 * Client/server API boundary schemas.
 *
 * These are intentionally minimal and portable (no Dates, no BigInts, no Prisma types).
 * The web frontend can validate responses at runtime without importing backend code.
 */

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const AdminMutationResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
});
export type AdminMutationResponse = z.infer<typeof AdminMutationResponseSchema>;

// -------------------------
// Admin: sites
// -------------------------

export const AdminSiteDbSchema = z.object({
  id: z.string(),
  code: z.string(),
  domain: z.string(),
  enabled: z.boolean(),
  currency: z.string(),
  affiliateTag: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminSiteDb = z.infer<typeof AdminSiteDbSchema>;

export const AdminSitesResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    sites: z.array(AdminSiteDbSchema),
  }),
});
export type AdminSitesResponse = z.infer<typeof AdminSitesResponseSchema>;

// Generic admin page response (for non-critical/less-typed pages).
export const AdminPageResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});
export type AdminPageResponse = z.infer<typeof AdminPageResponseSchema>;

export const DealSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'expired', 'scheduled']),
  expiresAt: z.string(), // ISO string
});
export type ApiDeal = z.infer<typeof DealSchema>;

export const ProductSchema = z.object({
  asin: z.string(),
  title: z.string(),
  imageUrl: z.string().nullable().optional(),
});
export type ApiProduct = z.infer<typeof ProductSchema>;

export const DealsResponseSchema = z.object({
  deals: z.array(DealSchema),
});
export type DealsResponse = z.infer<typeof DealsResponseSchema>;

export const ProductsResponseSchema = z.object({
  products: z.array(ProductSchema),
});
export type ProductsResponse = z.infer<typeof ProductsResponseSchema>;

// -------------------------
// Public: discovery
// -------------------------
export const DiscoveryCandidatePublicSchema = z.object({
  id: z.string(),
  title: z.string(),
  retailer: z.enum(['AMAZON', 'WALMART', 'TARGET', 'BEST_BUY']),
  category: z.string().nullable(),
  description: z.string().nullable(),
  imageQuery: z.string().nullable(),
  outboundUrl: z.string(),
  confidenceScore: z.number().nullable(),
  discoveredAt: z.string(),
});
export type DiscoveryCandidatePublic = z.infer<typeof DiscoveryCandidatePublicSchema>;

export const DiscoveryResponseSchema = z.object({
  now: z.string(),
  candidates: z.array(DiscoveryCandidatePublicSchema),
});
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;

// -------------------------
// Public: unaffiliated posts
// -------------------------
export const UnaffiliatedPostPublicSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  retailer: z.enum(['AMAZON', 'WALMART', 'TARGET', 'BEST_BUY']),
  category: z.string(),
  summary: z.string(),
  body: z.string().optional(), // only present on detail
  imageSetId: z.string().nullable(),
  outboundUrl: z.string(),
  source: z.enum(['DISCOVERY', 'AI_ENRICHED']),
  status: z.enum(['DRAFT', 'PUBLISHED', 'EXPIRED']),
  publishedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UnaffiliatedPostPublic = z.infer<typeof UnaffiliatedPostPublicSchema>;

export const UnaffiliatedPostsResponseSchema = z.object({
  now: z.string(),
  posts: z.array(UnaffiliatedPostPublicSchema.omit({ body: true }).extend({ body: z.undefined().optional() })),
});
export type UnaffiliatedPostsResponse = z.infer<typeof UnaffiliatedPostsResponseSchema>;

export const UnaffiliatedPostDetailResponseSchema = UnaffiliatedPostPublicSchema.extend({
  body: z.string(),
});
export type UnaffiliatedPostDetailResponse = z.infer<typeof UnaffiliatedPostDetailResponseSchema>;

// -------------------------
// Admin: dashboard
// -------------------------

export const AdminDbStatusSchema = z.object({
  status: z.enum(['ready', 'needs_migration', 'unreachable']),
  message: z.string().optional(),
  missingTables: z.array(z.string()).optional(),
  missingColumns: z.record(z.array(z.string())).optional(),
});
export type AdminDbStatus = z.infer<typeof AdminDbStatusSchema>;

export const AdminIngestionStatusSchema = z.object({
  finishedAt: z.string().nullable().optional(), // ISO string
  status: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export const AdminOpsHealthSchema = z.object({
  lastIngestion: AdminIngestionStatusSchema.nullable().optional(),
  lastIngestionAgeMinutes: z.number().int().nullable().optional(),
  ingestionFailures24h: z.number().int(),
  aiFailures24h: z.number().int(),
});
export type AdminOpsHealth = z.infer<typeof AdminOpsHealthSchema>;

export const AdminAlertSchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
});
export type AdminAlert = z.infer<typeof AdminAlertSchema>;

export const AdminDashboardMetricsSchema = z.object({
  liveDealsCount: z.number().int(),
  expiring: z.object({
    in1h: z.number().int(),
    in6h: z.number().int(),
    in24h: z.number().int(),
  }),
  newProductsToday: z.number().int(),
  aiActionsLast24h: z.number().int(),
  affiliateClicks: z.object({
    today: z.number().int(),
    last7d: z.number().int(),
  }),
  alerts: z.array(AdminAlertSchema),
});
export type AdminDashboardMetrics = z.infer<typeof AdminDashboardMetricsSchema>;

export const AdminDashboardResponseSchema = z.object({
  db: AdminDbStatusSchema,
  health: AdminOpsHealthSchema,
  metrics: AdminDashboardMetricsSchema,
});
export type AdminDashboardResponse = z.infer<typeof AdminDashboardResponseSchema>;

// -------------------------
// Admin: automation
// -------------------------

export const AdminAutomationConfigSchema = z.object({
  siteKey: z.string(),
  automationEnabled: z.boolean().optional(),
  discoveryEnabled: z.boolean().optional(),
  imageGenEnabled: z.boolean(),
  heroRegenerateAt: z.string().nullable().optional(),
  categoryRegenerateAt: z.string().nullable().optional(),
});
export type AdminAutomationConfig = z.infer<typeof AdminAutomationConfigSchema>;

export const AdminAutomationJobSchema = z.object({
  key: z.string(),
  name: z.string(),
  status: z.enum(['idle', 'running', 'paused']),
  lastRunAt: z.string().nullable(),
  lastError: z.string().nullable(),
});
export type AdminAutomationJob = z.infer<typeof AdminAutomationJobSchema>;

export const AdminAutomationDashboardResponseSchema = z.object({
  runs24h: z.number().int(),
  avgConfidence24h: z.number().nullable(),
  productsWithAI: z.number().int(),
  dealsFeatured: z.number().int(),
  dealsSuppressed: z.number().int(),
  errors: z.array(AdminAlertSchema),
  config: AdminAutomationConfigSchema,
  publishing: z.object({
    unaffiliatedAutoPublishEnabled: z.boolean(),
  }),
  schedules: z.array(
    z.object({
      jobType: z.enum(['DISCOVERY_SWEEP', 'UNAFFILIATED_PUBLISHER']),
      enabled: z.boolean(),
      cron: z.string(),
      timezone: z.string(),
      lastScheduledAt: z.string().nullable(),
      nextRunAt: z.string().nullable(),
      status: z.enum(['idle', 'running', 'blocked']),
      blockedReason: z.string().nullable(),
    }),
  ),
  jobs: z.array(AdminAutomationJobSchema),
});
export type AdminAutomationDashboardResponse = z.infer<typeof AdminAutomationDashboardResponseSchema>;

// Diagnostics (on-demand; no persistence)
export const AdminAiDiagnosticsResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.enum(['openai', 'perplexity']),
  model: z.string().nullable().optional(),
  outputText: z.string().nullable().optional(),
  raw: z.unknown().optional(),
  error: z.string().nullable().optional(),
});
export type AdminAiDiagnosticsResponse = z.infer<typeof AdminAiDiagnosticsResponseSchema>;

// DALL·E / Images API readiness test (backend-only; no persistence)
export const AdminDalleDiagnosticsResponseSchema = z.object({
  success: z.boolean(),
  error: z
    .object({
      message: z.string(),
      httpStatus: z.number().int().nullable().optional(),
      kind: z.enum(['access_denied', 'billing', 'rate_limited', 'bad_request', 'unknown']).optional(),
      raw: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  model: z.string(),
  size: z.string(),
  elapsedMs: z.number().int(),
  image: z
    .object({
      format: z.string().nullable().optional(),
      width: z.number().int().nullable().optional(),
      height: z.number().int().nullable().optional(),
      bytes: z.number().int(),
    })
    .nullable()
    .optional(),
  responseMeta: z.unknown().optional(),
});
export type AdminDalleDiagnosticsResponse = z.infer<typeof AdminDalleDiagnosticsResponseSchema>;

// -------------------------
// Admin: analytics
// -------------------------

export const AdminSiteSchema = z.object({
  key: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  domain: z.string().optional(),
});
export type AdminSite = z.infer<typeof AdminSiteSchema>;

export const AdminGaConfigSchema = z.object({
  enabled: z.boolean(),
  measurementId: z.string().nullable(),
  lastEventAt: z.string().nullable(),
});
export type AdminGaConfig = z.infer<typeof AdminGaConfigSchema>;

export const AdminCtrBySectionSchema = z.object({
  section: z.string(),
  impressions: z.number().int(),
  clicks: z.number().int(),
  ctr: z.number(),
});
export const AdminCtrByDealStateSchema = z.object({
  dealStatus: z.string(),
  impressions: z.number().int(),
  clicks: z.number().int(),
  ctr: z.number(),
});
export const AdminCtrTopCtaSchema = z.object({
  cta: z.string(),
  clicks: z.number().int(),
});

export const AdminCtrReportSchema = z.object({
  since: z.string(),
  bySection: z.array(AdminCtrBySectionSchema),
  byDealState: z.array(AdminCtrByDealStateSchema),
  topCtas: z.array(AdminCtrTopCtaSchema),
});
export type AdminCtrReport = z.infer<typeof AdminCtrReportSchema>;

export const AdminAnalyticsResponseSchema = z.object({
  selectedSite: z.string(),
  sites: z.array(AdminSiteSchema),
  ga: AdminGaConfigSchema,
  ctrReport: AdminCtrReportSchema,
});
export type AdminAnalyticsResponse = z.infer<typeof AdminAnalyticsResponseSchema>;

// -------------------------
// Admin: affiliate
// -------------------------

export const AffiliateProviderSchema = z.enum(['AMAZON', 'WALMART', 'TARGET']);
export type AffiliateProvider = z.infer<typeof AffiliateProviderSchema>;

export const AdminAffiliateProviderConfigSchema = z.object({
  provider: AffiliateProviderSchema,
  enabled: z.boolean(),
  affiliateId: z.string().nullable(),
  priority: z.number().int(),
  linkTemplate: z.string().nullable(),
});
export type AdminAffiliateProviderConfig = z.infer<typeof AdminAffiliateProviderConfigSchema>;

export const AdminAffiliatePreviewSchema = z.object({
  ok: z.boolean(),
  url: z.string().optional(),
  reason: z.string().optional(),
});
export type AdminAffiliatePreview = z.infer<typeof AdminAffiliatePreviewSchema>;

export const AdminAffiliateResponseSchema = z.object({
  siteKey: z.string(),
  enabled: z.boolean(),
  associateTag: z.string().nullable(),
  providerConfigs: z.array(AdminAffiliateProviderConfigSchema),
  sampleUrl: z.string().optional(),
  preview: AdminAffiliatePreviewSchema.optional(),
});
export type AdminAffiliateResponse = z.infer<typeof AdminAffiliateResponseSchema>;

// -------------------------
// Admin: deals
// -------------------------

export const ApiIngestionSourceSchema = z.enum(['AMAZON_BEST_SELLER', 'AMAZON_LIGHTNING', 'AMAZON_DEAL', 'MANUAL']);
export type ApiIngestionSource = z.infer<typeof ApiIngestionSourceSchema>;

export const ApiDealStatusSchema = z.enum(['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H', 'EXPIRED']);
export type ApiDealStatus = z.infer<typeof ApiDealStatusSchema>;

// Keep this permissive; backend may add placement types without requiring a shared package bump.
export const ApiPlacementTypeSchema = z.string();
export type ApiPlacementType = z.infer<typeof ApiPlacementTypeSchema>;

export const AdminDealRowSchema = z.object({
  id: z.string(),
  source: ApiIngestionSourceSchema,
  status: ApiDealStatusSchema,
  suppressed: z.boolean(),
  expiresAt: z.string(), // ISO string
  discountPercent: z.number().nullable(),
  currentPriceCents: z.number().int(),
  oldPriceCents: z.number().int().nullable(),
  currency: z.string(),
  lastEvaluatedAt: z.string().nullable().optional(),
  product: z.object({
    asin: z.string(),
    title: z.string(),
    imageUrl: z.string().nullable(),
    category: z.string().nullable(),
    categoryOverride: z.string().nullable(),
    tags: z.array(z.string()),
  }),
  placements: z.array(
    z.object({
      type: ApiPlacementTypeSchema,
      enabled: z.boolean(),
      startsAt: z.string(),
      endsAt: z.string(),
    }),
  ),
  derived: z.object({
    dealStateLabel: z.enum(['live', 'expiring', 'scheduled', 'paused', 'expired']),
    timeWindow: z.enum(['1h', '6h', '24h', 'later', 'expired']),
    priority: z.enum(['normal', 'featured', 'suppressed']),
    visibleSites: z.array(z.string()),
    activePlacementTypes: z.array(ApiPlacementTypeSchema),
    scheduledPlacementTypes: z.array(ApiPlacementTypeSchema),
  }),
});
export type AdminDealRow = z.infer<typeof AdminDealRowSchema>;

export const AdminDealsListResponseSchema = z.object({
  now: z.string().optional(),
  nextCursor: z.string().nullable(),
  deals: z.array(AdminDealRowSchema),
  sites: z.array(z.object({ key: z.string(), enabled: z.boolean() })),
});
export type AdminDealsListResponse = z.infer<typeof AdminDealsListResponseSchema>;

export const AdminDealMetricsSchema = z.object({
  since: z.string(),
  impressions: z.number().int(),
  clicks: z.number().int(),
  ctr: z.number(),
  bySite: z.array(z.object({ site: z.string(), impressions: z.number().int(), clicks: z.number().int(), ctr: z.number() })),
  byPartner: z.array(z.object({ partner: z.string(), clicks: z.number().int() })),
  aiNotes: z.object({ available: z.boolean(), note: z.string() }),
});
export type AdminDealMetrics = z.infer<typeof AdminDealMetricsSchema>;

