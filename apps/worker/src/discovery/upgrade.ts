import type { IngestionProvider, IngestionSource } from '@prisma/client';
import { prisma } from '@trendsinusa/db';

import { attachProductToPostingItem } from '../posting/lifecycle.js';

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function titleKey(s: string) {
  return normalizeWhitespace(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function retailerToProvider(retailer: string): IngestionProvider | null {
  const r = retailer.toUpperCase();
  if (r === 'AMAZON') return 'AMAZON';
  if (r === 'WALMART') return 'WALMART';
  if (r === 'TARGET') return 'TARGET';
  if (r === 'BEST_BUY') return 'BEST_BUY';
  return null;
}

function isNonManualSource(s: IngestionSource) {
  return s !== 'MANUAL';
}

/**
 * Upgrade ACTIVE DiscoveryCandidate rows into real Products (RetailProduct) by matching
 * normalized title + retailer/provider.
 *
 * - Does NOT create any products (no duplicates)
 * - Marks candidate REMOVED and stores provenance on Product
 * - Does NOT create affiliate links (approval-only later)
 */
export async function upgradeDiscoveryCandidatesToRetailProducts(params: { provider: IngestionProvider; limit?: number }) {
  const limit = params.limit ?? 200;
  const now = new Date();

  const candidates = await prisma.discoveryCandidate.findMany({
    where: { status: 'ACTIVE', retailer: params.provider as any, upgradedProductId: null },
    orderBy: [{ confidenceScore: 'desc' }, { discoveredAt: 'desc' }],
    take: limit,
    select: { id: true, title: true, retailer: true, category: true, confidenceScore: true, discoveredAt: true },
  });

  if (candidates.length === 0) {
    return { ok: true as const, upgraded: 0, skipped: 0 };
  }

  const products = await prisma.product.findMany({
    where: { ingestionProvider: params.provider, source: { not: 'MANUAL' }, discoveryCandidateId: null },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    take: 2000,
    select: { id: true, title: true, source: true },
  });

  const productByKey = new Map<string, { id: string }>();
  for (const p of products) {
    if (!p.title) continue;
    if (!isNonManualSource(p.source)) continue;
    const k = titleKey(p.title);
    if (!k) continue;
    // keep newest (already ordered by updatedAt desc)
    if (!productByKey.has(k)) productByKey.set(k, { id: p.id });
  }

  let upgraded = 0;
  let skipped = 0;

  for (const c of candidates) {
    const provider = retailerToProvider(String(c.retailer));
    if (!provider || provider !== params.provider) {
      skipped += 1;
      continue;
    }
    const k = titleKey(c.title);
    const match = productByKey.get(k);
    if (!match) {
      skipped += 1;
      continue;
    }

    // One-to-one mapping: once a product is used, don't reuse it for another candidate.
    productByKey.delete(k);

    await prisma.$transaction([
      prisma.product.update({
        where: { id: match.id },
        data: {
          discoveryCandidateId: c.id,
          discoveryDiscoveredAt: c.discoveredAt,
          discoveryConfidenceScore: c.confidenceScore ?? null,
          discoveryCategory: c.category ?? null,
        },
      }),
      prisma.discoveryCandidate.update({
        where: { id: c.id },
        data: { status: 'REMOVED', upgradedProductId: match.id, expiresAt: now },
      }),
    ]);

    // Posting lifecycle: DISCOVERY -> INGESTED, and attach product linkage (kill switch enforced inside).
    await attachProductToPostingItem({ discoveryCandidateId: c.id, productId: match.id }).catch(() => null);

    upgraded += 1;
  }

  return { ok: true as const, upgraded, skipped };
}

