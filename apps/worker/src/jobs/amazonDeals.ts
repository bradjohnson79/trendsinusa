import { prisma } from '@trendsinusa/db';
import type { DealStatus, IngestionProvider, IngestionSource } from '@prisma/client';
import { fetchProductWithOfferByASIN, fetchProductsWithOfferByCategory } from '../amazon/paapi.js';
import { createHash } from 'node:crypto';

function sha256Hex(s: string) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function uniqTrim(list: string[]) {
  return Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));
}

function deriveDealStatus(expiresAt: Date, now: Date): DealStatus {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 'EXPIRED';
  if (ms <= 60 * 60 * 1000) return 'EXPIRING_1H';
  if (ms <= 6 * 60 * 60 * 1000) return 'EXPIRING_6H';
  if (ms <= 24 * 60 * 60 * 1000) return 'EXPIRING_24H';
  return 'ACTIVE';
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

function isValidFutureDate(d: Date | null, now: Date): d is Date {
  return !!d && !Number.isNaN(d.getTime()) && d.getTime() > now.getTime();
}

export async function runAmazonDealDetection(params: {
  asins: string[];
  keywords: string[];
  limitPerKeyword: number;
  source?: IngestionSource;
  provider?: IngestionProvider;
}) {
  const now = new Date();
  const asins = uniqTrim(params.asins).map((a) => a.toUpperCase());
  const keywords = uniqTrim(params.keywords);

  const source: IngestionSource = params.source ?? 'AMAZON_DEAL';
  const provider: IngestionProvider = params.provider ?? 'AMAZON';

  const fetched: Array<Awaited<ReturnType<typeof fetchProductWithOfferByASIN>>> = [];

  for (const asin of asins) {
    const p = await fetchProductWithOfferByASIN(asin);
    if (p) fetched.push(p);
  }

  for (const kw of keywords) {
    const found = await fetchProductsWithOfferByCategory({ keyword: kw, limit: params.limitPerKeyword });
    fetched.push(...found);
  }

  const byAsin = new Map<string, NonNullable<(typeof fetched)[number]>>();
  for (const p of fetched) {
    if (!p?.asin) continue;
    if (!byAsin.has(p.asin)) byAsin.set(p.asin, p);
  }

  let evaluated = 0;
  let pricePointsCreated = 0;
  let dealsUpserted = 0;
  let dealsExpired = 0;
  let skippedNoPrice = 0;

  for (const p of byAsin.values()) {
    evaluated += 1;

    const priceCents = p.offer.currentPriceCents;
    const currency = p.offer.currency ?? 'USD';
    if (priceCents == null || priceCents <= 0) {
      skippedNoPrice += 1;
      continue;
    }

    // Ensure Product exists (Deals reference Products; never duplicate).
    const product = await prisma.product.upsert({
      where: { asin: p.asin },
      create: {
        asin: p.asin,
        source,
        ingestionProvider: provider,
        externalId: p.asin,
        title: p.title ?? '',
        imageUrl: p.imageUrl,
        imageUrls: p.imageUrls ?? [],
        category: p.category,
        productUrl: p.detailPageUrl,
        rating: p.rating ?? null,
        reviewCount: p.reviewCount ?? null,
        sourceFetchedAt: now,
      },
      update: {
        // Keep product normalization fields fresh; no deal/price logic here.
        source,
        ingestionProvider: provider,
        externalId: p.asin,
        title: p.title ?? '',
        imageUrl: p.imageUrl,
        imageUrls: p.imageUrls ?? [],
        category: p.category,
        productUrl: p.detailPageUrl,
        rating: p.rating ?? null,
        reviewCount: p.reviewCount ?? null,
        sourceFetchedAt: now,
      },
    });

    // Persist raw Amazon payload (read-only) for auditing/debug (best-effort).
    try {
      const rawJson = (p as any).raw ?? null;
      const payloadString = JSON.stringify(rawJson);
      const payloadHash = sha256Hex(payloadString);
      await prisma.productRawPayload.upsert({
        where: { productId_provider: { productId: product.id, provider: 'AMAZON' } },
        create: { productId: product.id, provider: 'AMAZON', payload: rawJson as any, payloadHash },
        update: { payload: rawJson as any, payloadHash, fetchedAt: now },
      });
    } catch {
      // ignore
    }

    // Historical reference = max observed price over last 30 days (excluding the just-fetched price point).
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const agg = await prisma.productPricePoint.aggregate({
      where: { productId: product.id, provider, currency, capturedAt: { gte: since } },
      _max: { priceCents: true },
    });
    const historicalRef = agg._max.priceCents ?? null;

    const promoFlag = p.offer.promotionFlag;
    const qualifiesByHistory = historicalRef != null && priceCents < historicalRef;
    const qualifies = qualifiesByHistory || promoFlag;

    // Audit price changes (best-effort): compare with previous latest snapshot.
    const prev = await prisma.productPricePoint.findFirst({
      where: { productId: product.id, provider, currency },
      orderBy: { capturedAt: 'desc' },
      select: { priceCents: true, isPromotion: true, promotionEndsAt: true, capturedAt: true },
    });

    // Always append a price point snapshot for future reference.
    await prisma.productPricePoint.create({
      data: {
        productId: product.id,
        provider,
        priceCents,
        currency,
        isPromotion: promoFlag,
        promotionEndsAt: p.offer.promotionEndsAt ?? null,
        capturedAt: now,
      },
    });
    pricePointsCreated += 1;

    if (
      prev &&
      (prev.priceCents !== priceCents ||
        Boolean(prev.isPromotion) !== Boolean(promoFlag) ||
        (prev.promotionEndsAt?.getTime() ?? 0) !== (p.offer.promotionEndsAt?.getTime() ?? 0))
    ) {
      await prisma.auditLog.create({
        data: {
          actorType: 'SYSTEM',
          entityType: 'PRICE',
          entityId: product.id,
          action: 'PRICE_CHANGED',
          summary: `Price changed for ${p.asin}`,
          before: {
            priceCents: prev.priceCents,
            isPromotion: prev.isPromotion,
            promotionEndsAt: prev.promotionEndsAt,
            capturedAt: prev.capturedAt,
          } as any,
          after: {
            priceCents,
            isPromotion: promoFlag,
            promotionEndsAt: p.offer.promotionEndsAt ?? null,
            capturedAt: now,
          } as any,
          metadata: { asin: p.asin, provider, currency } as any,
        },
      });
    }

    const dealKey = `amazon:${p.asin}`;
    const existingDeal = await prisma.deal.findUnique({
      where: { source_externalKey: { source, externalKey: dealKey } },
      select: { id: true, status: true, expiresAt: true },
    });

    if (!qualifies) {
      // Not a deal anymore -> mark expired (never delete; no fabricated values).
      if (existingDeal && existingDeal.status !== 'EXPIRED') {
        await prisma.deal.update({
          where: { id: existingDeal.id },
          data: { status: 'EXPIRED', expiresAt: now },
        });
        await prisma.auditLog.create({
          data: {
            actorType: 'SYSTEM',
            entityType: 'DEAL',
            entityId: existingDeal.id,
            action: 'DEAL_EXPIRED',
            summary: `Deal expired for ${p.asin}`,
            metadata: { asin: p.asin, reason: 'no_longer_qualifies', provider, currency } as any,
          },
        });
        dealsExpired += 1;
      }
      continue;
    }

    const expiresAt = isValidFutureDate(p.offer.promotionEndsAt, now) ? p.offer.promotionEndsAt : addHours(now, 24);
    const status = deriveDealStatus(expiresAt, now);

    // Never fabricate discounts:
    // - only set oldPrice/discount when a historical reference exists and is higher than current.
    const oldPriceCents = historicalRef != null && historicalRef > priceCents ? historicalRef : null;
    const discountPercent =
      oldPriceCents != null && oldPriceCents > 0 ? Math.round(((oldPriceCents - priceCents) / oldPriceCents) * 100) : null;

    const upserted = await prisma.deal.upsert({
      where: { source_externalKey: { source, externalKey: dealKey } },
      create: {
        productId: product.id,
        source,
        externalKey: dealKey,
        status,
        currentPriceCents: priceCents,
        oldPriceCents,
        discountPercent,
        currency,
        expiresAt,
      },
      update: {
        status,
        currentPriceCents: priceCents,
        oldPriceCents,
        discountPercent,
        currency,
        expiresAt,
        // NOTE: intentionally do NOT touch suppressed/AI flags here.
      },
    });
    await prisma.auditLog.create({
      data: {
        actorType: 'SYSTEM',
        entityType: 'DEAL',
        entityId: upserted.id,
        action: existingDeal ? 'DEAL_UPDATED' : 'DEAL_CREATED',
        summary: `${existingDeal ? 'Deal updated' : 'Deal created'} for ${p.asin}`,
        metadata: {
          asin: p.asin,
          provider,
          currency,
          qualifiesByHistory,
          promotionFlag: promoFlag,
          expiresAt,
          oldPriceCents,
          currentPriceCents: priceCents,
        } as any,
      },
    });
    dealsUpserted += 1;
  }

  return {
    source,
    provider,
    requested: { asins, keywords, limitPerKeyword: params.limitPerKeyword },
    evaluated,
    pricePointsCreated,
    dealsUpserted,
    dealsExpired,
    skippedNoPrice,
  };
}

