# Strategic Partnership Enablement (Internal)

Objective: enable partnerships **without weakening platform independence** and without external analytics.

## Partnership surfaces (supported)

### 1) Syndicated deal feed (API)

- Endpoint: `/api/partners/<partnerKey>/feed`
- Auth: partner token (`x-partner-token` header preferred; `?token=` supported)
- Output: JSON deals with **attribution-safe outbound URLs** (always through `/out/*`)
- Scope gating + kill switch: `config/partners.json`

### 2) Co-branded pages (planned surface)

We intentionally keep co-branded UI minimal and config-driven.
Current implementation focuses on API feed + attribution + safeguards.

## Partner boundaries (non-negotiable)

- **Data visibility**
  - Only fields needed to render deals (title, image, price, expiry, category)
  - No raw user identifiers; no raw IPs in DB
- **Revenue attribution**
  - Tracked via `partner=<key>` in referrer params for impressions/clicks
  - Outbound clicks always logged through `/out/*`
- **Content ownership**
  - Platform owns ingestion + canonical deal state
  - Partners receive a syndicated view (read-only)

## Partnership metrics (internal)

Admin page: `/admin/partners`

Reported (last 30 days):
- impressions, clicks, CTR
- estimated revenue (EPC assumption)
- provider mix
- incremental contribution proxy: share of total clicks/revenue
- cannibalization proxy: overlap of dealIds clicked by partner vs organically

## Operational safeguards

- **Partner isolation**
  - Each partner has its own token (stored in env via `tokenEnvVar`)
  - Scope gating (`feed`, `cobranded_page`)
  - Kill switch (`enabled=false`)
- **Performance monitoring**
  - Rate limiting on partner feed + outbound routes
  - Admin metrics to detect spikes/abuse
- **Kill switches**
  - Disable partner in `config/partners.json` (immediate 404)

## How integration works (partner-facing)

Partner provides:
- Partner key (agreed)
- Domain(s) using the feed
- Desired refresh cadence for feed pulls

Platform provides:
- Feed endpoint + token
- Stable schema for feed payload
- Attribution-ready outbound URLs

Partner does **not** get:
- Direct DB access
- Ability to bypass `/out/*` redirects
- Ability to modify ingestion logic or deal state

