import 'server-only';

import type { DealStatus, IngestionSource, PlacementType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/src/server/prisma';
import { readSitesConfig } from '@trendsinusa/shared';

export type AdminDealsFilters = {
  status?: 'all' | 'live' | 'expiring' | 'scheduled' | 'paused' | 'expired';
  window?: 'all' | '1h' | '6h' | '24h';
  site?: string; // site key
  category?: string;
  source?: IngestionSource | 'all';
  q?: string; // search: title/asin
};

export type AdminDealRow = {
  id: string;
  source: IngestionSource;
  status: DealStatus;
  suppressed: boolean;
  expiresAt: Date;
  discountPercent: number | null;
  currentPriceCents: number;
  oldPriceCents: number | null;
  currency: string;
  lastEvaluatedAt: Date | null;
  product: {
    asin: string;
    title: string;
    imageUrl: string | null;
    category: string | null;
    categoryOverride: string | null;
    tags: string[];
  };
  placements: Array<{ type: PlacementType; enabled: boolean; startsAt: Date; endsAt: Date }>;
  derived: {
    dealStateLabel: 'live' | 'expiring' | 'scheduled' | 'paused' | 'expired';
    timeWindow: '1h' | '6h' | '24h' | 'later' | 'expired';
    priority: 'normal' | 'featured' | 'suppressed';
    visibleSites: string[];
    activePlacementTypes: PlacementType[];
    scheduledPlacementTypes: PlacementType[];
  };
};

const LIVE_STATUSES: DealStatus[] = ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'];
const EXPIRING_STATUSES: DealStatus[] = ['EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'];
const PREMIUM_TYPES: PlacementType[] = ['SPOTLIGHT', 'EDITORS_PICK', 'FEATURED'];

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function normalizeSiteTags(tags: string[]): string[] {
  return tags.filter((t) => t.startsWith('site:')).map((t) => t.slice('site:'.length));
}

function computeTimeWindow(now: Date, expiresAt: Date): AdminDealRow['derived']['timeWindow'] {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  if (ms <= 1 * 60 * 60 * 1000) return '1h';
  if (ms <= 6 * 60 * 60 * 1000) return '6h';
  if (ms <= 24 * 60 * 60 * 1000) return '24h';
  return 'later';
}

function placementBuckets(now: Date, placements: AdminDealRow['placements']) {
  const active = placements.filter((p) => p.enabled && p.startsAt <= now && p.endsAt > now).map((p) => p.type);
  const scheduled = placements.filter((p) => p.enabled && p.startsAt > now).map((p) => p.type);
  return { active, scheduled };
}

function deriveRow(now: Date, row: Omit<AdminDealRow, 'derived'>): AdminDealRow['derived'] {
  const expired = row.status === 'EXPIRED' || row.expiresAt <= now;
  const sites = normalizeSiteTags(row.product.tags);
  const { active, scheduled } = placementBuckets(now, row.placements);
  const hasActivePremium = active.some((t) => PREMIUM_TYPES.includes(t));
  const priority: AdminDealRow['derived']['priority'] = row.suppressed ? 'suppressed' : hasActivePremium ? 'featured' : 'normal';

  const dealStateLabel: AdminDealRow['derived']['dealStateLabel'] = row.suppressed
    ? 'paused'
    : expired
      ? 'expired'
      : row.status === 'ACTIVE'
        ? scheduled.length
          ? 'scheduled'
          : 'live'
        : EXPIRING_STATUSES.includes(row.status)
          ? 'expiring'
          : 'live';

  return {
    dealStateLabel,
    timeWindow: computeTimeWindow(now, row.expiresAt),
    priority,
    visibleSites: sites,
    activePlacementTypes: active,
    scheduledPlacementTypes: scheduled,
  };
}

export async function getAdminDeals(params: {
  limit: number;
  cursor?: string | null;
  filters: AdminDealsFilters;
}) {
  const now = new Date();
  const f = params.filters;

  const where: Prisma.DealWhereInput = {};
  const productWhere: Prisma.ProductWhereInput = {};
  const productOr: Prisma.ProductWhereInput[] = [];

  // Query filters (only visibility/urgency dimensions; no pricing edits here)
  if (f.source && f.source !== 'all') where.source = f.source;

  if (f.site && f.site !== 'all') {
    productWhere.tags = { has: `site:${f.site}` };
  }

  if (f.category && f.category.trim()) {
    const c = f.category.trim();
    productOr.push({ categoryOverride: c }, { category: c });
  }

  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    productOr.push({ asin: { contains: q } }, { title: { contains: q, mode: 'insensitive' } });
  }

  if (productOr.length) productWhere.OR = productOr;
  if (Object.keys(productWhere).length) where.product = productWhere;

  let expiresAtFilter: Prisma.DateTimeFilter<'Deal'> | null = null;
  const ensureExpiresGtNow = () => {
    expiresAtFilter = expiresAtFilter ?? {};
    expiresAtFilter.gt = now;
  };

  // Window filter: only meaningful for non-expired deals.
  if (f.window && f.window !== 'all') {
    const end = f.window === '1h' ? hoursFromNow(1) : f.window === '6h' ? hoursFromNow(6) : hoursFromNow(24);
    expiresAtFilter = { gt: now, lte: end };
  }

  // Status filter (derived semantics)
  if (f.status && f.status !== 'all') {
    if (f.status === 'paused') {
      where.suppressed = true;
    } else if (f.status === 'expired') {
      // Expired: ignore window filter and include either explicit status or time-based expiry.
      expiresAtFilter = null;
      const andClauses = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [...andClauses, { OR: [{ status: 'EXPIRED' }, { expiresAt: { lte: now } }] }];
    } else if (f.status === 'expiring') {
      where.suppressed = false;
      where.status = { in: EXPIRING_STATUSES };
      ensureExpiresGtNow();
    } else if (f.status === 'live') {
      where.suppressed = false;
      where.status = { in: LIVE_STATUSES };
      ensureExpiresGtNow();
    } else if (f.status === 'scheduled') {
      // Scheduled = has a future placement window (feature/sponsor scheduled).
      where.suppressed = false;
      ensureExpiresGtNow();
      where.placements = { some: { enabled: true, startsAt: { gt: now }, type: { in: PREMIUM_TYPES } } };
    }
  }

  if (expiresAtFilter) where.expiresAt = expiresAtFilter;

  const rows = await prisma.deal.findMany({
    where,
    include: {
      product: { select: { asin: true, title: true, imageUrl: true, category: true, categoryOverride: true, tags: true } },
      placements: { select: { type: true, enabled: true, startsAt: true, endsAt: true } },
    },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const nextCursor = rows.length > params.limit ? rows[params.limit]!.id : null;
  const page = rows.slice(0, params.limit).map((r) => {
    const base: Omit<AdminDealRow, 'derived'> = {
      id: r.id,
      source: r.source,
      status: r.status,
      suppressed: r.suppressed,
      expiresAt: r.expiresAt,
      discountPercent: r.discountPercent,
      currentPriceCents: r.currentPriceCents,
      oldPriceCents: r.oldPriceCents,
      currency: r.currency,
      lastEvaluatedAt: r.lastEvaluatedAt,
      product: r.product,
      placements: r.placements,
    };
    return { ...base, derived: deriveRow(now, base) };
  });

  const sites = await readSitesConfig().then((x) => x.config.sites.map((s) => ({ key: s.key, enabled: s.enabled })));

  return { now, nextCursor, deals: page, sites };
}

