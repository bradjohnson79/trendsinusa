import 'server-only';

export const PARTNER_API_VERSION = 1 as const;
export const PARTNER_API_SCHEMA_DATE = '2026-01-15' as const;

export type PartnerApiMeta = {
  version: typeof PARTNER_API_VERSION;
  schemaDate: typeof PARTNER_API_SCHEMA_DATE;
  generatedAt: string;
  partner: { key: string; siteKey: string };
};

