export type IngestedProduct = {
  externalId: string;
  title: string;
  imageUrl?: string | null;
  category?: string | null;
  productUrl?: string | null;
};

export type IngestedDeal = {
  externalProductId: string;
  price: number; // decimal units
  originalPrice?: number | null; // decimal units
  currency: string; // ISO-ish, e.g. USD
  expiresAt: string; // ISO timestamp
};

