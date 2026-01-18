import type { DealStatus, IngestionSource } from '@prisma/client';
import { prisma } from '@trendsinusa/db';
import type { IngestedDeal, IngestedProduct } from '@trendsinusa/shared';

import { requireIngestionEnabled } from './gate.js';
import { upgradeDiscoveryCandidatesToRetailProducts } from '../discovery/upgrade.js';

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function deriveDealStatus(expiresAt: Date, now: Date): DealStatus {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 'EXPIRED';
  const hours = ms / (60 * 60 * 1000);
  if (hours <= 1) return 'EXPIRING_1H';
  if (hours <= 6) return 'EXPIRING_6H';
  if (hours <= 24) return 'EXPIRING_24H';
  return 'ACTIVE';
}

function buildExternalDealKey(params: {
  source: IngestionSource;
  externalProductId: string;
  expiresAt: Date;
}): string {
  return `${params.source}:${params.externalProductId}:${params.expiresAt.toISOString()}`;
}

export async function runIngestion(params: {
  source: IngestionSource;
  payload: { products: IngestedProduct[]; deals: IngestedDeal[] };
}): Promise<{ productsProcessed: number; dealsProcessed: number }> {
  const startedAt = new Date();
  const run = await prisma.ingestionRun.create({
    data: {
      source: params.source,
      status: 'STARTED',
      startedAt,
    },
  });

  try {
    // Global kill switch: ingestion is fail-closed by default.
    await requireIngestionEnabled({ siteKey: 'trendsinusa' });

    // Safety rail: ingestion must not run without at least one enabled site configured.
    // This fails gracefully (records the run failure) and does NOT seed automatically.
    const enabledSites = await prisma.site.count({ where: { enabled: true } });
    if (enabledSites < 1) {
      throw new Error('No enabled site configured. Create and enable at least one site in Admin → Sites.');
    }

    const now = new Date();

    // 1) Upsert products
    const productByExternalId = new Map<string, { id: string; asin: string }>();
    for (const p of params.payload.products) {
      // Rule: Product identity is asin (unique). For the seed source, we use a deterministic synthetic ASIN.
      const asin = p.externalId.toUpperCase();
      const row = await prisma.product.upsert({
        where: { asin },
        create: {
          asin,
          source: params.source,
          externalId: p.externalId,
          title: p.title,
          imageUrl: p.imageUrl ?? null,
          category: p.category ?? null,
          productUrl: p.productUrl ?? null,
        },
        update: {
          title: p.title,
          imageUrl: p.imageUrl ?? null,
          category: p.category ?? null,
          productUrl: p.productUrl ?? null,
        },
        select: { id: true, asin: true },
      });
      productByExternalId.set(p.externalId, row);
    }

    // Upgrade any matching DiscoveryCandidate -> Product after new products exist.
    // NOTE: runIngestion does not currently carry provider info; Product.ingestionProvider defaults to AMAZON.
    // To avoid upgrading from seed/manual ingestion, we only attempt upgrades for non-MANUAL sources.
    if (params.source !== 'MANUAL') {
      await upgradeDiscoveryCandidatesToRetailProducts({ provider: 'AMAZON', limit: 200 }).catch(() => null);
    }

    // 2) Upsert deals (idempotent by unique externalKey)
    let dealsProcessed = 0;
    for (const d of params.payload.deals) {
      const productRef = productByExternalId.get(d.externalProductId);
      if (!productRef) continue; // ignore deals without products

      const expiresAt = new Date(d.expiresAt);
      const externalKey = buildExternalDealKey({
        source: params.source,
        externalProductId: d.externalProductId,
        expiresAt,
      });

      const status = deriveDealStatus(expiresAt, now);

      await prisma.deal.upsert({
        where: { source_externalKey: { source: params.source, externalKey } },
        create: {
          source: params.source,
          externalKey,
          productId: productRef.id,
          status,
          suppressed: false,
          currentPriceCents: toCents(d.price),
          oldPriceCents: d.originalPrice != null ? toCents(d.originalPrice) : null,
          currency: d.currency,
          expiresAt,
          lastEvaluatedAt: now,
        },
        update: {
          // Do not overwrite suppression on reruns.
          status,
          currentPriceCents: toCents(d.price),
          oldPriceCents: d.originalPrice != null ? toCents(d.originalPrice) : null,
          currency: d.currency,
          expiresAt,
          lastEvaluatedAt: now,
        },
      });

      dealsProcessed += 1;
    }

    // 3) Mark expired deals (in case clock moved since last ingestion)
    await prisma.deal.updateMany({
      where: { source: params.source, expiresAt: { lte: now }, status: { not: 'EXPIRED' } },
      data: { status: 'EXPIRED' },
    });

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        productsProcessed: params.payload.products.length,
        dealsProcessed,
      },
    });

    return { productsProcessed: params.payload.products.length, dealsProcessed };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILURE',
        finishedAt: new Date(),
        error: message,
      },
    });
    throw e;
  }
}

