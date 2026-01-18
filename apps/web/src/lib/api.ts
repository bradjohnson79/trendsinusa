import type { z } from 'zod';
import {
  AdminAffiliateResponseSchema,
  AdminAiDiagnosticsResponseSchema,
  AdminAnalyticsResponseSchema,
  AdminAutomationDashboardResponseSchema,
  AdminDashboardResponseSchema,
  AdminDalleDiagnosticsResponseSchema,
  AdminDealMetricsSchema,
  AdminDealsListResponseSchema,
  AdminMutationResponseSchema,
  AdminPageResponseSchema,
  AdminSitesResponseSchema,
  ApiErrorSchema,
  DealsResponseSchema,
  DiscoveryResponseSchema,
  ProductsResponseSchema,
  UnaffiliatedPostDetailResponseSchema,
  UnaffiliatedPostsResponseSchema,
} from '@trendsinusa/shared/api';

export class ApiClientError extends Error {
  name = 'ApiClientError' as const;
  status: number | null;
  details: unknown;

  constructor(message: string, opts: { status?: number | null; details?: unknown } = {}) {
    super(message);
    this.status = opts.status ?? null;
    this.details = opts.details;
  }
}

type Schema<T> = z.ZodType<T>;

function apiBase(): string {
  // No validation at build time. Optional override if you want a different origin in dev.
  const v = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE;
  return v ? String(v).replace(/\/+$/, '') : '';
}

async function fetchJson<T>(path: string, schema: Schema<T>, init?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const raw = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(raw);
    const msg = parsed.success
      ? parsed.data.message ?? parsed.data.error
      : `Request failed (${res.status} ${res.statusText})`;
    throw new ApiClientError(msg, { status: res.status, details: raw });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiClientError('Invalid API response shape', { status: res.status, details: parsed.error.flatten() });
  }
  return parsed.data;
}

export const api = {
  products: {
    list(signal?: AbortSignal) {
      return fetchJson('/api/products', ProductsResponseSchema, signal ? { signal } : undefined);
    },
  },
  deals: {
    list(signal?: AbortSignal) {
      return fetchJson('/api/deals', DealsResponseSchema, signal ? { signal } : undefined);
    },
  },
  discovery: {
    list(signal?: AbortSignal, params?: { limit?: number }) {
      const sp = new URLSearchParams();
      if (params?.limit != null) sp.set('limit', String(params.limit));
      const qs = sp.toString();
      return fetchJson(`/api/discovery${qs ? `?${qs}` : ''}`, DiscoveryResponseSchema, signal ? { signal } : undefined);
    },
  },
  posts: {
    list(signal?: AbortSignal, params?: { limit?: number; category?: string }) {
      const sp = new URLSearchParams();
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.category) sp.set('category', params.category);
      const qs = sp.toString();
      return fetchJson(`/api/posts${qs ? `?${qs}` : ''}`, UnaffiliatedPostsResponseSchema, signal ? { signal } : undefined);
    },
    getBySlug(slug: string, signal?: AbortSignal) {
      return fetchJson(`/api/posts/${encodeURIComponent(slug)}`, UnaffiliatedPostDetailResponseSchema, signal ? { signal } : undefined);
    },
  },
  admin: {
    dashboard(signal?: AbortSignal) {
      return fetchJson('/api/admin', AdminDashboardResponseSchema, signal ? { signal } : undefined);
    },
    automationDashboard(signal?: AbortSignal) {
      return fetchJson('/api/admin/automation', AdminAutomationDashboardResponseSchema, signal ? { signal } : undefined);
    },
    enableAutomation() {
      return fetchJson('/api/admin/automation/enable', AdminMutationResponseSchema, { method: 'POST', body: JSON.stringify({}) });
    },
    disableAutomation() {
      return fetchJson('/api/admin/automation/disable', AdminMutationResponseSchema, { method: 'POST', body: JSON.stringify({}) });
    },
    setUnaffiliatedAutoPublishEnabled(input: { enabled: boolean }) {
      return fetchJson('/api/admin/automation/unaffiliated-auto-publish', AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    setAutomationSchedule(jobType: 'DISCOVERY_SWEEP' | 'UNAFFILIATED_PUBLISHER', input: { enabled?: boolean; cron?: string; timezone?: string }) {
      return fetchJson(`/api/admin/automation/schedules/${encodeURIComponent(jobType)}`, AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    runAutomationJob(jobKey: string) {
      return fetchJson(`/api/admin/automation/jobs/${encodeURIComponent(jobKey)}/run`, AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    cancelAutomationJob(jobKey: string) {
      return fetchJson(`/api/admin/automation/jobs/${encodeURIComponent(jobKey)}/cancel`, AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    diagnostics: {
      openai(prompt: string) {
        return fetchJson('/api/admin/automation/diagnostics/openai', AdminAiDiagnosticsResponseSchema, {
          method: 'POST',
          body: JSON.stringify({ prompt }),
        });
      },
      perplexity(query: string) {
        return fetchJson('/api/admin/automation/diagnostics/perplexity', AdminAiDiagnosticsResponseSchema, {
          method: 'POST',
          body: JSON.stringify({ query }),
        });
      },
      dalle() {
        return fetchJson('/api/admin/diagnostics/dalle', AdminDalleDiagnosticsResponseSchema);
      },
    },
    providers: {
      list(signal?: AbortSignal, params?: { siteKey?: string }) {
        const qs = params?.siteKey ? `?siteKey=${encodeURIComponent(params.siteKey)}` : '';
        return fetchJson(`/api/admin/providers${qs}`, AdminPageResponseSchema, signal ? { signal } : undefined);
      },
      enable(provider: string, params?: { siteKey?: string }) {
        const qs = params?.siteKey ? `?siteKey=${encodeURIComponent(params.siteKey)}` : '';
        return fetchJson(`/api/admin/providers/${encodeURIComponent(provider)}/enable${qs}`, AdminMutationResponseSchema, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      },
      disable(provider: string, params?: { siteKey?: string }) {
        const qs = params?.siteKey ? `?siteKey=${encodeURIComponent(params.siteKey)}` : '';
        return fetchJson(`/api/admin/providers/${encodeURIComponent(provider)}/disable${qs}`, AdminMutationResponseSchema, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      },
    },
    analytics(signal?: AbortSignal, params?: { site?: string }) {
      const qs = params?.site ? `?site=${encodeURIComponent(params.site)}` : '';
      return fetchJson(`/api/admin/analytics${qs}`, AdminAnalyticsResponseSchema, signal ? { signal } : undefined);
    },
    affiliate(signal?: AbortSignal) {
      return fetchJson('/api/admin/affiliate', AdminAffiliateResponseSchema, signal ? { signal } : undefined);
    },
    saveGa4Config(input: { siteKey: string; enabled: boolean; measurementId: string | null }) {
      return fetchJson('/api/admin/analytics/ga4', AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    setImageGenEnabled(input: { enabled: boolean }) {
      return fetchJson('/api/admin/automation/image-gen', AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    requestHeroRegenerate() {
      return fetchJson('/api/admin/automation/hero-regenerate', AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    requestCategoryRegenerate() {
      return fetchJson('/api/admin/automation/category-regenerate', AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    saveAffiliateSettings(input: { enabled: boolean; associateTag: string | null }) {
      return fetchJson('/api/admin/affiliate/settings', AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    saveAffiliateProviderConfig(input: {
      provider: string;
      enabled: boolean;
      affiliateId: string | null;
      priority: number;
      linkTemplate: string | null;
    }) {
      return fetchJson('/api/admin/affiliate/provider', AdminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    deals: {
      list(params?: {
        limit?: number;
        cursor?: string | null;
        status?: string;
        window?: string;
        site?: string;
        category?: string;
        source?: string;
        q?: string;
      }) {
        const sp = new URLSearchParams();
        if (params?.limit != null) sp.set('limit', String(params.limit));
        if (params?.cursor) sp.set('cursor', params.cursor);
        if (params?.status) sp.set('status', params.status);
        if (params?.window) sp.set('window', params.window);
        if (params?.site) sp.set('site', params.site);
        if (params?.category) sp.set('category', params.category);
        if (params?.source) sp.set('source', params.source);
        if (params?.q) sp.set('q', params.q);
        const qs = sp.toString();
        return fetchJson(`/api/admin/deals${qs ? `?${qs}` : ''}`, AdminDealsListResponseSchema);
      },
      metrics(dealId: string) {
        return fetchJson(`/api/admin/deals/${encodeURIComponent(dealId)}/metrics`, AdminDealMetricsSchema);
      },
      pause(ids: string[]) {
        return fetchJson('/api/admin/deals/pause', AdminMutationResponseSchema, { method: 'POST', body: JSON.stringify({ ids }) });
      },
      resume(ids: string[]) {
        return fetchJson('/api/admin/deals/resume', AdminMutationResponseSchema, { method: 'POST', body: JSON.stringify({ ids }) });
      },
      forceExpire(ids: string[]) {
        return fetchJson('/api/admin/deals/force-expire', AdminMutationResponseSchema, {
          method: 'POST',
          body: JSON.stringify({ ids }),
        });
      },
      reevaluate(ids: string[]) {
        return fetchJson('/api/admin/deals/reevaluate', AdminMutationResponseSchema, { method: 'POST', body: JSON.stringify({ ids }) });
      },
      feature(ids: string[]) {
        return fetchJson('/api/admin/deals/feature', AdminMutationResponseSchema, { method: 'POST', body: JSON.stringify({ ids }) });
      },
    },

    sites: {
      list(signal?: AbortSignal) {
        return fetchJson('/api/admin/sites', AdminSitesResponseSchema, signal ? { signal } : undefined);
      },
      create(input: { code: string; domain: string; enabled: boolean; currency: string; affiliateTag: string }) {
        return fetchJson('/api/admin/sites', AdminMutationResponseSchema, { method: 'POST', body: JSON.stringify(input) });
      },
      update(id: string, input: Partial<{ code: string; domain: string; enabled: boolean; currency: string; affiliateTag: string }>) {
        return fetchJson(`/api/admin/sites/${encodeURIComponent(id)}`, AdminMutationResponseSchema, { method: 'PATCH', body: JSON.stringify(input) });
      },
    },

    ingestionPreview: {
      runAmazonDryRun() {
        return fetchJson('/api/admin/ingestion-preview/amazon', AdminMutationResponseSchema, { method: 'POST', body: JSON.stringify({}) });
      },
    },

    pages: {
      get(path: string) {
        const p = path.startsWith('/') ? path : `/${path}`;
        return fetchJson(`/api/admin${p}`, AdminPageResponseSchema);
      },
    },
  },
};

