# Portfolio Summary (Auto-generated)

Generated: 2026-01-15T05:34:05.181Z

This repo is designed as a **multi-site portfolio** with one shared engine:
- **Config**: `config/sites.json`
- **Platform core**: monorepo code under `apps/` and `packages/`
- **Per-site overrides**: `sites[].overrides` in config (no code forks)

## Site Registry

| key | enabled | domain | defaultCategories | affiliatePriorities | heroTone |
| --- | --- | --- | --- | --- | --- |
| trendsinusa | yes | trendsinusa.com | ALL | AMAZON | neutral |

## Data Sources (Internal)

- **Traffic proxy**: `ClickEvent` rows
  - impressions: `href = "event://impression"`
  - outbound clicks: `referrer event=affiliate_click`
  - site attribution: `referrer site=<SITE_KEY>`
- **Revenue proxy**: estimated from outbound clicks using static EPC assumptions per provider (see admin pages).
- **Content inventory**:
  - products routed to a site via `Product.tags` containing `site:<key>`
  - live deals are `Deal.status in (ACTIVE/EXPIRING_*)` and `expiresAt > now`

## Monetization Model (Internal)

- Central redirect + logging:
  - `apps/web/app/out/amazon/[asin]/route.ts`
  - `apps/web/app/out/[provider]/[asin]/route.ts`
- Provider selection policy:
  - `apps/web/src/server/affiliate/linkBuilder.ts`
  - per-site priority: `sites[].affiliatePriorities`

## Automation Flows (Internal)

- Hourly ingestion: `apps/worker/src/jobs/hourly.ts`
- Shared ingestion pipeline: `apps/worker/src/ingestion/pipeline.ts`
- Site routing (post-ingestion): `apps/worker/src/sites/router.ts` (tags products with `site:<key>`)

## Exit Readiness Notes

- **Partial divestment**: transfer a subset of `sites[].key` and their associated domains + affiliate IDs.
- **Full sale**: transfer repo + DB + `config/sites.json` + env secrets (documented separately).
- **Partnership**: enable additional providers via `AffiliateProviderConfig` and per-product mappings (no code forks).
