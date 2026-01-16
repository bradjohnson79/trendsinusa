import type { ServerEnv } from '@trendsinusa/shared';
import { getServerEnv } from '@trendsinusa/shared';
import { createHmac, createHash } from 'node:crypto';

export type PaApiProduct = {
  asin: string;
  title: string | null;
  detailPageUrl: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  brand: string | null;
  // Best-effort; categories in PA API are browse nodes, not freeform taxonomy.
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  raw: unknown;
};

export type PaApiOffer = {
  currentPriceCents: number | null;
  currency: string | null;
  promotionFlag: boolean;
  promotionEndsAt: Date | null;
  rawOffers: unknown;
};

export type PaApiProductWithOffer = PaApiProduct & { offer: PaApiOffer };

type PaApiConfig = {
  accessKey: string;
  secretKey: string;
  associateTag: string;
  host: string;
  region: string;
  marketplace: string;
};

function getPaApiConfig(env: ServerEnv = getServerEnv()): PaApiConfig {
  const accessKey = env.AMAZON_ACCESS_KEY ?? '';
  const secretKey = env.AMAZON_SECRET_KEY ?? '';
  const associateTag = env.AMAZON_ASSOCIATE_TAG ?? '';
  if (!accessKey || !secretKey || !associateTag) {
    throw new Error('Missing PA API env vars. Set AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_ASSOCIATE_TAG.');
  }
  // US defaults; can be expanded for CA/UK later.
  return {
    accessKey,
    secretKey,
    associateTag,
    host: 'webservices.amazon.com',
    region: 'us-east-1',
    marketplace: 'www.amazon.com',
  };
}

function sha256Hex(input: string) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, data: string) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function amzDate(now = new Date()) {
  // YYYYMMDD'T'HHMMSS'Z'
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function signV4(params: {
  method: 'POST';
  host: string;
  path: string;
  region: string;
  service: string;
  accessKey: string;
  secretKey: string;
  xAmzTarget: string;
  body: string;
  now?: Date;
}) {
  const { amzDate: xAmzDate, dateStamp } = amzDate(params.now);
  const canonicalUri = params.path;
  const canonicalQuerystring = '';

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${params.host}\n` +
    `x-amz-date:${xAmzDate}\n` +
    `x-amz-target:${params.xAmzTarget}\n`;

  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const payloadHash = sha256Hex(params.body);

  const canonicalRequest =
    `${params.method}\n` +
    `${canonicalUri}\n` +
    `${canonicalQuerystring}\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${params.region}/${params.service}/aws4_request`;
  const stringToSign = `${algorithm}\n${xAmzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;

  const kDate = hmac(`AWS4${params.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, params.region);
  const kService = hmac(kRegion, params.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `${algorithm} Credential=${params.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { xAmzDate, authorization };
}

async function paApiRequest<T>(cfg: PaApiConfig, params: { target: 'GetItems' | 'SearchItems'; body: unknown }) {
  const path = `/paapi5/${params.target.toLowerCase()}`;
  const body = JSON.stringify(params.body);
  const xAmzTarget = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${params.target}`;

  const { xAmzDate, authorization } = signV4({
    method: 'POST',
    host: cfg.host,
    path,
    region: cfg.region,
    service: 'ProductAdvertisingAPI',
    accessKey: cfg.accessKey,
    secretKey: cfg.secretKey,
    xAmzTarget,
    body,
  });

  const url = `https://${cfg.host}${path}`;
  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: cfg.host,
    'x-amz-date': xAmzDate,
    'x-amz-target': xAmzTarget,
    authorization,
  };

  return await fetchWithRetries<T>(url, { method: 'POST', headers, body });
}

async function fetchWithRetries<T>(
  url: string,
  init: RequestInit,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 500;

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();

      if (res.status === 429 || res.status === 503) {
        const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 150);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        throw new Error(`PA API HTTP ${res.status}: ${text.slice(0, 500)}`);
      }

      const json = JSON.parse(text) as any;
      if (json?.Errors?.length) {
        const code = json.Errors[0]?.Code ?? 'PAAPI_ERROR';
        const msg = json.Errors[0]?.Message ?? 'Unknown error';
        // Rate limit errors sometimes come back as 200 with Errors payload.
        if (String(code).toLowerCase().includes('toomany') || String(msg).toLowerCase().includes('rate')) {
          const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 150);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error(`PA API ${code}: ${msg}`);
      }

      return json as T;
    } catch (e) {
      lastErr = e;
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 150);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function normalizeItem(item: any): PaApiProduct {
  const asin = item?.ASIN ?? null;
  const title = item?.ItemInfo?.Title?.DisplayValue ?? null;
  const brand = item?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ?? null;
  const detailPageUrl = item?.DetailPageURL ?? null;
  const imageUrl = item?.Images?.Primary?.Large?.URL ?? item?.Images?.Primary?.Medium?.URL ?? null;
  const imageUrls = [
    item?.Images?.Primary?.Large?.URL,
    item?.Images?.Primary?.Medium?.URL,
    item?.Images?.Primary?.Small?.URL,
    ...(Array.isArray(item?.Images?.Variants)
      ? item.Images.Variants.flatMap((v: any) => [v?.Large?.URL, v?.Medium?.URL, v?.Small?.URL])
      : []),
  ].filter((u: unknown): u is string => typeof u === 'string' && u.length > 0);

  const category =
    item?.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName ??
    item?.BrowseNodeInfo?.WebsiteSalesRank?.SalesRank?.[0]?.BrowseNodeId ??
    null;

  const rating = typeof item?.CustomerReviews?.StarRating?.Value === 'number' ? item.CustomerReviews.StarRating.Value : null;
  const reviewCount = typeof item?.CustomerReviews?.Count === 'number' ? item.CustomerReviews.Count : null;

  return {
    asin: asin ?? '',
    title,
    detailPageUrl,
    imageUrl,
    imageUrls: Array.from(new Set(imageUrls)),
    brand,
    category,
    rating,
    reviewCount,
    raw: item,
  };
}

function parseCentsFromAmount(amount: unknown): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  // PA API price is often decimal dollars; store cents.
  return Math.round(amount * 100);
}

function parsePromotionEndsAt(listing: any): Date | null {
  const promos = listing?.Promotions;
  const arr = Array.isArray(promos) ? promos : [];
  const candidates: Date[] = [];
  for (const p of arr) {
    const endRaw = p?.EndTime ?? p?.EndsAt ?? null;
    if (typeof endRaw === 'string') {
      const d = new Date(endRaw);
      if (!Number.isNaN(d.getTime())) candidates.push(d);
    }
  }
  if (candidates.length == 0) return null;
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] ?? null;
}

function normalizeOffer(item: any): PaApiOffer {
  const listing = item?.Offers?.Listings?.[0] ?? null;
  const priceAmount = listing?.Price?.Amount ?? null;
  const currency = typeof listing?.Price?.Currency === 'string' ? listing.Price.Currency : null;
  const currentPriceCents = parseCentsFromAmount(priceAmount);

  const hasPromotions = Array.isArray(listing?.Promotions) && listing.Promotions.length > 0;
  const hasSavings =
    (typeof listing?.Savings?.Amount === 'number' && listing.Savings.Amount > 0) ||
    (typeof listing?.Savings?.Percentage === 'number' && listing.Savings.Percentage > 0);
  const promotionFlag = Boolean(hasPromotions || hasSavings);

  const promotionEndsAt = parsePromotionEndsAt(listing);

  return {
    currentPriceCents,
    currency,
    promotionFlag,
    promotionEndsAt,
    rawOffers: item?.Offers ?? null,
  };
}

export async function fetchProductByASIN(asin: string): Promise<PaApiProduct | null> {
  const cfg = getPaApiConfig();
  const payload = {
    ItemIds: [asin],
    PartnerTag: cfg.associateTag,
    PartnerType: 'Associates',
    Marketplace: cfg.marketplace,
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'Images.Primary.Large',
      'Images.Primary.Medium',
      'Images.Primary.Small',
      'Images.Variants.Large',
      'Images.Variants.Medium',
      'Images.Variants.Small',
      'BrowseNodeInfo.BrowseNodes',
      'CustomerReviews.Count',
      'CustomerReviews.StarRating',
    ],
  };

  const res = await paApiRequest<any>(cfg, { target: 'GetItems', body: payload });
  const item = res?.ItemsResult?.Items?.[0] ?? null;
  if (!item?.ASIN) return null;
  return normalizeItem(item);
}

export async function fetchProductsByCategory(params: { keyword: string; limit: number }): Promise<PaApiProduct[]> {
  const cfg = getPaApiConfig();
  const payload = {
    Keywords: params.keyword,
    ItemCount: Math.min(10, Math.max(1, params.limit)),
    PartnerTag: cfg.associateTag,
    PartnerType: 'Associates',
    Marketplace: cfg.marketplace,
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'Images.Primary.Large',
      'Images.Primary.Medium',
      'Images.Primary.Small',
      'Images.Variants.Large',
      'Images.Variants.Medium',
      'Images.Variants.Small',
      'BrowseNodeInfo.BrowseNodes',
      'CustomerReviews.Count',
      'CustomerReviews.StarRating',
    ],
  };

  const res = await paApiRequest<any>(cfg, { target: 'SearchItems', body: payload });
  const items = res?.SearchResult?.Items ?? [];
  return (Array.isArray(items) ? items : []).map(normalizeItem).filter((p) => !!p.asin);
}

export async function fetchProductWithOfferByASIN(asin: string): Promise<PaApiProductWithOffer | null> {
  const cfg = getPaApiConfig();
  const payload = {
    ItemIds: [asin],
    PartnerTag: cfg.associateTag,
    PartnerType: 'Associates',
    Marketplace: cfg.marketplace,
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'Images.Primary.Large',
      'Images.Primary.Medium',
      'Images.Primary.Small',
      'Images.Variants.Large',
      'Images.Variants.Medium',
      'Images.Variants.Small',
      'BrowseNodeInfo.BrowseNodes',
      'CustomerReviews.Count',
      'CustomerReviews.StarRating',
      'Offers.Listings.Price',
      'Offers.Listings.Savings',
      'Offers.Listings.Promotions',
    ],
  };

  const res = await paApiRequest<any>(cfg, { target: 'GetItems', body: payload });
  const item = res?.ItemsResult?.Items?.[0] ?? null;
  if (!item?.ASIN) return null;

  const base = normalizeItem(item);
  return { ...base, offer: normalizeOffer(item) };
}

export async function fetchProductsWithOfferByCategory(params: { keyword: string; limit: number }): Promise<PaApiProductWithOffer[]> {
  const cfg = getPaApiConfig();
  const payload = {
    Keywords: params.keyword,
    ItemCount: Math.min(10, Math.max(1, params.limit)),
    PartnerTag: cfg.associateTag,
    PartnerType: 'Associates',
    Marketplace: cfg.marketplace,
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'Images.Primary.Large',
      'Images.Primary.Medium',
      'Images.Primary.Small',
      'Images.Variants.Large',
      'Images.Variants.Medium',
      'Images.Variants.Small',
      'BrowseNodeInfo.BrowseNodes',
      'CustomerReviews.Count',
      'CustomerReviews.StarRating',
      'Offers.Listings.Price',
      'Offers.Listings.Savings',
      'Offers.Listings.Promotions',
    ],
  };

  const res = await paApiRequest<any>(cfg, { target: 'SearchItems', body: payload });
  const items = res?.SearchResult?.Items ?? [];
  const arr = Array.isArray(items) ? items : [];
  return arr.filter((it) => Boolean(it?.ASIN)).map((it) => ({ ...normalizeItem(it), offer: normalizeOffer(it) }));
}
