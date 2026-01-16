import 'server-only';

/**
 * Prep-only: Google Indexing API hook.
 *
 * Not activated (no callers). When enabled later, this should:
 * - Authenticate with a service account
 * - Publish URL_UPDATED notifications for key pages
 *
 * NOTE: Google Indexing API is intended for JobPosting/BroadcastEvent content types.
 * Many sites instead use Search Console + sitemaps. We keep this as a future hook only.
 */
export async function submitIndexingHint(params: { url: string }): Promise<void> {
  void params;
  // intentionally no-op
}

