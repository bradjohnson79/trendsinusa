# White‑Label Network Enablement (Internal)

Objective: enable third parties to operate **white-labeled sites** powered by the platform **without forks** and without exposing core logic.

## 1) Final boundaries (configurable vs fixed)

### Configurable (licensee-controlled)

Per-site configuration lives in `config/sites.json`:
- **Domain**: `sites[].domain` (used for Host → site resolution)
- **Branding**: `sites[].branding.*` (theme tokens, logo URL)
- **Copy tone controls**: `sites[].overrides.heroTone`
- **Homepage layout**: `sites[].overrides.homepageLayout`
- **Category emphasis**: `sites[].overrides.categoryEmphasis`
- **Premium rules**: `sites[].overrides.featuredPlacementRules`
- **Monetization policy**: `sites[].affiliatePriorities` (provider allowlist + order)

### Fixed / non-negotiable (platform-controlled)

- ingestion pipeline + deal state derivation
- deal suppression + blocked products
- affiliate redirect + logging layer (`/out/*`)
- event tracking structure (`ClickEvent`)
- quality/compliance gates for public/partner outputs
- admin auth/security

## 2) Branding abstraction

- The platform selects a site by **Host header** (matches `sites[].domain`) with safe fallback to env `SITE_KEY`.
- Styling remains Tailwind-based; theme tokens are config inputs (not free-form CSS execution).

## 3) Quality standards (enforced)

All public + partner deal outputs are gated by shared standards:
- `Deal.suppressed=false`
- `Deal.status in ACTIVE/EXPIRING_*`
- `Deal.expiresAt > now`
- `Deal.currentPriceCents > 0`
- `Product.blocked=false`
- `Product.title != ""`

These are intentionally conservative, credibility-first rules.

## 4) Isolation mechanisms

### Data separation

- Deals/products are routed to sites via `Product.tags` containing `site:<key>`.
- Public queries filter by this site tag.

### Traffic isolation

- Tracking referrers include `site=<key>` based on resolved site (Host → siteKey).

### Revenue attribution

- Outbound clicks flow through `/out/*` routes which log provider + site in `ClickEvent.referrer`.

## 5) Governance & onboarding

- Primary onboarding doc: `docs/DATAROOM/ONBOARDING.md`
- Licensing boundaries: `docs/DATAROOM/LICENSING.md`
- Partner API: `docs/DATAROOM/PARTNER_API.md`

