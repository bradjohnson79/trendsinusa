import { prisma } from '@trendsinusa/db';
import type { IngestionSource } from '@prisma/client';
import { fetchProductByASIN, fetchProductsByCategory } from '../amazon/paapi.js';
import { createHash } from 'node:crypto';

function uniqTrim(list: string[]) {
  return Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));
}

export async function runAmazonProductIngestion(params: {
  asins: string[];
  keywords: string[];
  limitPerKeyword: number;
  source?: IngestionSource;
}) {
  const now = new Date();
  const asins = uniqTrim(params.asins).map((a) => a.toUpperCase());
  const keywords = uniqTrim(params.keywords);

  const source: IngestionSource = params.source ?? 'AMAZON_DEAL';

  const products: Array<{
    asin: string;
    title: string | null;
    imageUrl: string | null;
    imageUrls: string[];
    category: string | null;
    productUrl: string | null;
    rating: number | null;
    reviewCount: number | null;
    raw: unknown;
  }> = [];

  // 1) ASIN fetches
  for (const asin of asins) {
    const p = await fetchProductByASIN(asin);
    if (!p) continue;
    products.push({
      asin: p.asin,
      title: p.title,
      imageUrl: p.imageUrl,
      imageUrls: p.imageUrls ?? (p.imageUrl ? [p.imageUrl] : []),
      category: p.category,
      productUrl: p.detailPageUrl,
      rating: p.rating,
      reviewCount: p.reviewCount,
      raw: p.raw,
    });
  }

  // 2) Keyword/category searches
  for (const kw of keywords) {
    const found = await fetchProductsByCategory({ keyword: kw, limit: params.limitPerKeyword });
    for (const p of found) {
      products.push({
        asin: p.asin,
        title: p.title,
        imageUrl: p.imageUrl,
        imageUrls: p.imageUrls ?? (p.imageUrl ? [p.imageUrl] : []),
        category: p.category,
        productUrl: p.detailPageUrl,
        rating: p.rating,
        reviewCount: p.reviewCount,
        raw: p.raw,
      });
    }
  }

  // Dedup by ASIN (idempotent)
  const byAsin = new Map<string, (typeof products)[number]>();
  for (const p of products) {
    if (!p.asin) continue;
    if (!byAsin.has(p.asin)) byAsin.set(p.asin, p);
  }

  let upserted = 0;
  for (const p of byAsin.values()) {
    // Worker only ingests products, not deals.
    const product = await prisma.product.upsert({
      where: { asin: p.asin },
      create: {
        asin: p.asin,
        source,
        ingestionProvider: 'AMAZON',
        externalId: p.asin,
        title: p.title ?? '',
        imageUrl: p.imageUrl,
        imageUrls: p.imageUrls ?? [],
        category: p.category,
        productUrl: p.productUrl,
        rating: p.rating ?? null,
        reviewCount: p.reviewCount ?? null,
        sourceFetchedAt: now,
      },
      update: {
        source,
        ingestionProvider: 'AMAZON',
        externalId: p.asin,
        title: p.title ?? '',
        imageUrl: p.imageUrl,
        imageUrls: p.imageUrls ?? [],
        category: p.category,
        productUrl: p.productUrl,
        rating: p.rating ?? null,
        reviewCount: p.reviewCount ?? null,
        sourceFetchedAt: now,
      },
    });

    // Store raw PA API payload separately (idempotent per product+provider).
    const rawJson = p.raw ?? null;
    const payloadString = JSON.stringify(rawJson);
    const payloadHash = createHash('sha256').update(payloadString, 'utf8').digest('hex');
    await prisma.productRawPayload.upsert({
      where: { productId_provider: { productId: product.id, provider: 'AMAZON' } },
      create: { productId: product.id, provider: 'AMAZON', payload: rawJson as any, payloadHash },
      update: { payload: rawJson as any, payloadHash, fetchedAt: new Date() },
    });

    upserted += 1;
  }

  return {
    source,
    requested: { asins, keywords, limitPerKeyword: params.limitPerKeyword },
    fetched: { asinsFound: products.filter((p) => asins.includes(p.asin)).length, totalRaw: products.length },
    productsUpserted: upserted,
  };
}

