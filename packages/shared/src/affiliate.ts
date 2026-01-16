export type AffiliateLinkResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'disabled' | 'missing_associate_id' | 'invalid_url' };

function tryParseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

/**
 * Wrap an Amazon URL with an Associate tag. This is the ONLY place we should build outbound
 * affiliate URLs, so that a single config change updates everything.
 */
export function buildAmazonAffiliateUrl(params: {
  url: string;
  enabled: boolean;
  associateTag?: string | null;
}): AffiliateLinkResult {
  const { url, enabled, associateTag } = params;
  if (!enabled) return { ok: false, reason: 'disabled' };
  if (!associateTag) return { ok: false, reason: 'missing_associate_id' };

  const parsed = tryParseUrl(url);
  if (!parsed) return { ok: false, reason: 'invalid_url' };

  // Amazon affiliate tag parameter is `tag`.
  parsed.searchParams.set('tag', associateTag);
  return { ok: true, url: parsed.toString() };
}

