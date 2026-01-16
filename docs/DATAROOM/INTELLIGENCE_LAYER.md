# Intelligence Layer (Privacy-Safe) — Internal

Objective: transform platform data into **aggregated intelligence outputs** without exposing raw user data or weakening privacy.

## Non-negotiables

- No raw user data in outputs (no user-agent strings, no identifiers, no per-user trails).
- No partner-specific leakage:
  - partner endpoints only return that partner’s own aggregated metrics
  - no cross-partner comparisons or portfolio totals
- Time-windowed summaries only.

## Intelligence outputs (current)

Generated from internal event logs (`ClickEvent`) + deal metadata (`Deal`, `Product`):

- **Category momentum**
  - delta in click-share over last 7 days vs previous 7 days
- **Conversion signals**
  - CTR proxy (clicks / impressions)
  - time-to-expiry buckets (clicks + estimated revenue)
  - deal-state performance (EXPIRING_1H/6H/24H/ACTIVE)
- **Deal lifecycle patterns**
  - average deal lifetime (createdAt → expiresAt)
- **Price volatility (proxy)**
  - per-category discount dispersion on clicked deals (stddev of discount fraction)

## Safe aggregation rules

### Minimum threshold suppression

To reduce inference risk for small sites/partners:
- **basic tier**: minClicks=20 and minImpressions=100
- **pro tier**: minClicks=10 and minImpressions=50

Only categories meeting thresholds are returned.

### Revenue definition

Revenue is **estimated** from outbound clicks using a conservative EPC assumption (cents per provider). This is stable over time for comparability.

## Intelligence surfaces

### Internal dashboards

- `/admin/signals` (internal, pro view)

### Partner reports (closed API)

- `GET /api/partners/<partner>/v1/intelligence?days=30`
  - returns partner-attributed aggregates only
  - tier controlled by `config/partners.json` (`tier=basic|pro`)

### Subscription-grade outputs (prep)

Same primitives can be reused for future subscription exports, but should remain:
- aggregated
- thresholded
- time-windowed

## Access controls

- Partners are token-gated and scope-gated via `config/partners.json`.
- Tier controls output detail; never grants raw access.
- Rate limiting applies to partner endpoints.

