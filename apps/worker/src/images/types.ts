export type ImageSizeKey = 'card' | 'thumbnail' | 'og' | 'hero';

export type ImageIntentEntityType = 'DISCOVERY_CANDIDATE' | 'RETAIL_PRODUCT';
export type ImageIntentImageType = 'CARD' | 'HERO' | 'OG';
export type ImageIntentStatus = 'PENDING' | 'GENERATED' | 'FAILED';

export type ImageVariantSpec = {
  key: ImageSizeKey;
  width: number;
  height: number;
};

export const IMAGE_VARIANTS: Record<ImageIntentImageType, ImageVariantSpec[]> = {
  CARD: [
    { key: 'card', width: 800, height: 800 },
    { key: 'thumbnail', width: 400, height: 400 },
  ],
  OG: [{ key: 'og', width: 1200, height: 630 }],
  // Not specified in Phase F-1, but required to make imageType=HERO actionable.
  HERO: [{ key: 'hero', width: 1920, height: 1080 }],
};

