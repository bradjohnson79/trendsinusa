# Ecosystem Economics (Preview) — Internal

Objective: monetize ecosystem access **only** in ways that scale with value created and do not degrade partner outcomes.

## Principles (non-negotiable)

- **Alignment**: platform earns when partners earn.
- **No rent-seeking**: no unavoidable fixed fees without demonstrated value delivery.
- **Transparency**: partners can reproduce numbers with the same assumptions.
- **Privacy**: no raw user data; aggregates only; minimum thresholds to reduce inference risk.
- **No forced activation**: billing/statement surfaces are gated by `ECOSYSTEM_BILLING_MODE` and scopes.

## Monetization models (supported as scaffolding)

### 1) Access-based (API tiers)

Purpose: control feature access and operational capacity.
- Tiering: `basic` vs `pro` (signals depth, limits)
- Pricing: **$0 by default** (any future pricing must remain value-delivery aligned)

### 2) Usage-based (volume/frequency)

Value-aligned usage definition (no raw API logs required):
- Units: **partner-attributed affiliate clicks** (value-delivery event)
- Optional pricing: `usageCentsPer1000Clicks` with `freeClicksPerMonth`

### 3) Performance-based (revenue share)

Default recommended model:
- Platform take-rate: `platformFeeBps` (basis points)
- Split: gross estimated affiliate revenue → platform vs partner/site net

## Accounting separation

Statements are computed from **aggregated, time-windowed** signals:
- Gross estimated revenue (directional; EPC assumptions)
- Platform revenue (fee)
- Partner/site net revenue (gross - fee)

## Transparency mechanisms

- Internal preview dashboard: `/admin/monetization`
- Partner statement endpoint (scope + env gated):
  - `GET /api/partners/<partner>/v1/statement?days=30`
  - Requires partner scope: `billing`
  - Requires `ECOSYSTEM_BILLING_MODE` != `off`

## Configuration surfaces

`config/partners.json` supports:
- `tier`: `basic|pro`
- `monetization`: `{ model, platformFeeBps, usageCentsPer1000Clicks, freeClicksPerMonth, currency }`

