export type CountryCode = 'US' | 'CA' | 'GB' | 'AU';

export type CurrencyCode = 'USD' | 'CAD' | 'GBP' | 'AUD';

export type AmazonRegion = 'NA' | 'EU' | 'AU';

export type SiteCountry = 'usa' | 'canada' | 'uk' | 'australia';

export type BrandingInfo = {
  name: string;
  shortName: string;
  primaryColor: string;
  accentColor: string;
};

export type SiteConfig = {
  country: SiteCountry;
  countryCode: CountryCode;
  currency: CurrencyCode;
  affiliateTag: string;
  amazonRegion: AmazonRegion;
  branding: BrandingInfo;
};

