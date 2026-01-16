import type { IngestedDeal, IngestedProduct } from '@trendsinusa/shared';

function isoIn(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

export type SeedIngestionPayload = {
  products: IngestedProduct[];
  deals: IngestedDeal[];
};

/**
 * Seed source: deterministic-ish sample payload to exercise state logic.
 * Not tied to Amazon; future sources will implement the same shape.
 */
export async function fetchSeedIngestionPayload(): Promise<SeedIngestionPayload> {
  const products: IngestedProduct[] = [
    {
      externalId: 'seed-001',
      title: 'Seed Product A (Headphones)',
      imageUrl: 'https://example.com/seed-a.jpg',
      category: 'Electronics',
      productUrl: 'https://example.com/products/seed-001',
    },
    {
      externalId: 'seed-002',
      title: 'Seed Product B (Coffee Maker)',
      imageUrl: 'https://example.com/seed-b.jpg',
      category: 'Home',
      productUrl: 'https://example.com/products/seed-002',
    },
    {
      externalId: 'seed-003',
      title: 'Seed Product C (Running Shoes)',
      imageUrl: 'https://example.com/seed-c.jpg',
      category: 'Sports',
      productUrl: 'https://example.com/products/seed-003',
    },
  ];

  const deals: IngestedDeal[] = [
    {
      externalProductId: 'seed-001',
      price: 59.99,
      originalPrice: 99.99,
      currency: 'USD',
      expiresAt: isoIn(1), // EXPIRING_1H
    },
    {
      externalProductId: 'seed-002',
      price: 79.0,
      originalPrice: 129.0,
      currency: 'USD',
      expiresAt: isoIn(6), // EXPIRING_6H
    },
    {
      externalProductId: 'seed-003',
      price: 49.5,
      originalPrice: 89.5,
      currency: 'USD',
      expiresAt: isoIn(24), // EXPIRING_24H
    },
    {
      externalProductId: 'seed-003',
      price: 44.0,
      originalPrice: 89.5,
      currency: 'USD',
      expiresAt: isoIn(-2), // EXPIRED (already)
    },
  ];

  return { products, deals };
}

