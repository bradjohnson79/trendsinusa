import 'server-only';

import { unstable_cache } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/src/server/prisma';
import { getResolvedSiteKey, siteTag } from '@/src/server/site';

const LIVE_STATUSES = ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] as const;

function geoStateTag(state: string) {
  return `geo:us:${state.toLowerCase()}`;
}

function geoCityTag(state: string, city: string) {
  return `geo:us:${state.toLowerCase()}:${city.toLowerCase()}`;
}

export type TopicKey =
  | 'seasonal:winter'
  | 'seasonal:spring'
  | 'seasonal:summer'
  | 'seasonal:fall'
  | 'event:black-friday'
  | 'event:prime-day'
  | 'lifestyle:fitness'
  | 'lifestyle:home'
  | 'lifestyle:beauty'
  | 'lifestyle:outdoors';

type TopicDef = {
  key: TopicKey;
  title: string;
  description: string;
  // category keyword matches (case-insensitive) against category/categoryOverride.
  categoryKeywords: string[];
  // optional: only consider topic "active" inside a date window.
  activeWindow?: { startMonth: number; startDay: number; endMonth: number; endDay: number };
};

const TOPICS: TopicDef[] = [
  { key: 'seasonal:winter', title: 'Winter deals', description: 'Seasonal picks for winter.', categoryKeywords: ['winter', 'heating', 'coat', 'boots'] },
  { key: 'seasonal:spring', title: 'Spring refresh deals', description: 'Seasonal picks for spring.', categoryKeywords: ['spring', 'garden', 'cleaning'] },
  { key: 'seasonal:summer', title: 'Summer deals', description: 'Seasonal picks for summer.', categoryKeywords: ['summer', 'outdoor', 'pool', 'travel'] },
  { key: 'seasonal:fall', title: 'Fall deals', description: 'Seasonal picks for fall.', categoryKeywords: ['fall', 'autumn', 'school'] },
  {
    key: 'event:black-friday',
    title: 'Black Friday-style deals',
    description: 'Event-style discounts, updated regularly.',
    categoryKeywords: ['electronics', 'tv', 'laptop', 'gaming'],
    activeWindow: { startMonth: 11, startDay: 1, endMonth: 12, endDay: 5 },
  },
  {
    key: 'event:prime-day',
    title: 'Prime Day-style deals',
    description: 'Event-style discounts, updated regularly.',
    categoryKeywords: ['electronics', 'home', 'kitchen'],
    activeWindow: { startMonth: 7, startDay: 1, endMonth: 7, endDay: 31 },
  },
  { key: 'lifestyle:fitness', title: 'Fitness deals', description: 'Gear and essentials for fitness.', categoryKeywords: ['fitness', 'gym', 'workout', 'health'] },
  { key: 'lifestyle:home', title: 'Home deals', description: 'Home essentials and upgrades.', categoryKeywords: ['home', 'kitchen', 'decor', 'furniture'] },
  { key: 'lifestyle:beauty', title: 'Beauty deals', description: 'Beauty and personal care picks.', categoryKeywords: ['beauty', 'skincare', 'hair'] },
  { key: 'lifestyle:outdoors', title: 'Outdoors deals', description: 'Outdoor and travel-ready picks.', categoryKeywords: ['outdoor', 'camp', 'hike', 'travel'] },
];

function isInWindow(now: Date, w: NonNullable<TopicDef['activeWindow']>): boolean {
  // month is 1-12 in config
  const start = new Date(Date.UTC(now.getUTCFullYear(), w.startMonth - 1, w.startDay, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), w.endMonth - 1, w.endDay, 23, 59, 59));
  return now >= start && now <= end;
}

function topicProductFilter(def: TopicDef) {
  const ors = def.categoryKeywords.map((k) => ({ contains: k, mode: 'insensitive' as const }));
  return {
    OR: [
      ...ors.map((o) => ({ categoryOverride: o })),
      ...ors.map((o) => ({ category: o })),
    ],
  };
}

export async function getTopicDefinition(key: string): Promise<TopicDef | null> {
  const def = TOPICS.find((t) => t.key === key);
  if (!def) return null;
  if (def.activeWindow && !isInWindow(new Date(), def.activeWindow)) return null;
  return def;
}

export async function getAvailableTopics(): Promise<TopicDef[]> {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      const liveWhereBase: Prisma.DealWhereInput = {
        suppressed: false,
        status: { in: [...LIVE_STATUSES] },
        expiresAt: { gt: now },
        product: { tags: { has: tag } },
      };

      const out: TopicDef[] = [];
      for (const def of TOPICS) {
        if (def.activeWindow && !isInWindow(now, def.activeWindow)) continue;
        const count = await prisma.deal.count({
          where: {
            ...liveWhereBase,
            product: { ...(liveWhereBase.product as Prisma.ProductWhereInput), tags: { has: tag }, ...topicProductFilter(def) },
          },
        });
        if (count > 0) out.push(def);
      }
      return out;
    },
    ['segments:topics'],
    { revalidate: 600 },
  );

  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getDealsForTopic(topicKey: TopicKey, limit: number) {
  const def = await getTopicDefinition(topicKey);
  if (!def) return null;

  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      return await prisma.deal.findMany({
        where: {
          suppressed: false,
          status: { in: [...LIVE_STATUSES] },
          expiresAt: { gt: now },
          product: { tags: { has: tag }, ...topicProductFilter(def) },
        },
        orderBy: { expiresAt: 'asc' },
        take: limit,
        include: { product: true },
      });
    },
    [`segments:topic:${topicKey}:${limit}`],
    { revalidate: 60 },
  );

  try {
    return { def, deals: await fn() };
  } catch {
    return { def, deals: [] };
  }
}

export async function getGeoDeals(params: { state?: string; city?: string; limit: number }) {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());
      const geoTag =
        params.state && params.city
          ? geoCityTag(params.state, params.city)
          : params.state
            ? geoStateTag(params.state)
            : null;

      const tagsFilter = geoTag ? { hasEvery: [tag, geoTag] } : { has: tag };

      return await prisma.deal.findMany({
        where: {
          suppressed: false,
          status: { in: [...LIVE_STATUSES] },
          expiresAt: { gt: now },
          product: { tags: tagsFilter },
        },
        orderBy: { expiresAt: 'asc' },
        take: params.limit,
        include: { product: true },
      });
    },
    [`segments:geo:${params.state ?? 'us'}:${params.city ?? ''}:${params.limit}`],
    { revalidate: 120 },
  );

  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function getAvailableGeo(): Promise<{ states: string[]; citiesByState: Record<string, string[]> }> {
  const fn = unstable_cache(
    async () => {
      const now = new Date();
      const tag = siteTag(await getResolvedSiteKey());

      const rows = await prisma.deal.findMany({
        where: {
          suppressed: false,
          status: { in: [...LIVE_STATUSES] },
          expiresAt: { gt: now },
          product: { tags: { has: tag } },
        },
        select: { product: { select: { tags: true } } },
        take: 5000,
      });

      const states = new Set<string>();
      const citiesByState = new Map<string, Set<string>>();

      for (const r of rows) {
        const tags = r.product?.tags ?? [];
        for (const t of tags) {
          if (!t.startsWith('geo:us:')) continue;
          const parts = t.split(':');
          // geo:us:<state> or geo:us:<state>:<city>
          const state = parts[2] ?? null;
          const city = parts[3] ?? null;
          if (!state) continue;
          states.add(state);
          if (city) {
            const set = citiesByState.get(state) ?? new Set<string>();
            set.add(city);
            citiesByState.set(state, set);
          }
        }
      }

      const citiesObj: Record<string, string[]> = {};
      for (const [st, set] of citiesByState.entries()) {
        citiesObj[st] = Array.from(set).sort((a, b) => a.localeCompare(b));
      }

      return { states: Array.from(states).sort((a, b) => a.localeCompare(b)), citiesByState: citiesObj };
    },
    ['segments:geo:available'],
    { revalidate: 600 },
  );

  try {
    return await fn();
  } catch {
    return { states: [], citiesByState: {} };
  }
}

