# Partner API (Closed / Internal)

This is a **partner-only**, read-only API. It is not public and should not be indexed.

## Principles

- No public access.
- Read-only only (no writes).
- Strong isolation:
  - per-partner token
  - per-partner scopes
  - per-partner rate limits
  - partner kill switch (`enabled=false`)
- Data quality constraints are preserved (only live, non-suppressed deals).

## Configuration

File: `config/partners.json`

Per partner:
- `enabled`: kill switch (disabled returns 404)
- `siteKey`: which site inventory is exposed
- `scopes`: allowed endpoints (`feed`, `categories`, `trends`)
- `rateLimitPerMinute`: throttle per partner
- `maxLimit`: maximum `limit` accepted by endpoints
- `tokenEnvVar`: env var name containing secret token

## Authentication

Provide token via:
- HTTP header: `x-partner-token: <secret>` (preferred)
- or query: `?token=<secret>` (allowed, but avoid logging leakage)

Invalid/disabled partner returns **404** to avoid endpoint discovery.

## Versioning & contracts

All endpoints are **versioned** under `/v1/`.

Each response includes:
- `meta.version` (integer)
- `meta.schemaDate` (string, YYYY-MM-DD)
- headers:
  - `x-partner-api-version`
  - `x-partner-api-schema-date`

### Deprecation rules

- `/v1/*` responses are **backward compatible** within a schemaDate.
- Changes follow:
  - additive fields only
  - never rename/remove fields in-place
  - introduce `/v2/*` for breaking changes

## Endpoints (v1)

### Deals feed

`GET /api/partners/<partnerKey>/v1/deals?limit=50`

Scope: `feed`

Response shape:
- `items[]`:
  - `asin`, `title`, `imageUrl`, `category`
  - `currentPriceCents`, `oldPriceCents`, `currency`, `expiresAt`
  - `outboundUrl` (**always** through `/out/*` and contains `partner=<key>` attribution)

### Category summaries

`GET /api/partners/<partnerKey>/v1/categories?limit=50`

Scope: `categories`

Response:
- `items[]`:
  - `category`
  - `liveDeals`
  - `endingSoonDeals` (expires within 6h)
  - `minPriceCents`, `maxPriceCents`

### Trend snapshot

`GET /api/partners/<partnerKey>/v1/trends?hours=24`

Scope: `trends`

Response:
- `inventory` live counts + expiry buckets
- `performance`:
  - `clicksByDealState` (partner-attributed clicks)
  - `trendingDeals[]` (partner-attributed clicks, bounded)

## Attribution

Partner attribution is carried via:
- `partner=<key>` param in tracking referrers/outbound redirects
- outbound URLs always include `partner=<key>` and a `section` identifier

## Rate limiting

- Partner endpoints are rate-limited (fixed-window, in-memory hook).
- For multi-instance/serverless, swap limiter storage to a shared store.

