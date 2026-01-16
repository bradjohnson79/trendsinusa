# Separation Boundaries (Auto-generated)

Generated: 2026-01-15T05:34:05.181Z

## Config vs Code

- **Config** (`config/sites.json`):
  - site identity: key/name/domain
  - routing hints: defaultCategories
  - monetization policy: affiliatePriorities
  - presentation overrides: homepageLayout, heroTone, categoryEmphasis, featuredPlacementRules
- **Code**:
  - ingestion + maintenance: `apps/worker/`
  - web UI + redirects + admin: `apps/web/`
  - shared contracts/env: `packages/shared/`
  - DB schema/client: `packages/db/`

## Site vs Platform

- **Platform** = shared engine (ingestion, affiliate builder, admin analytics).
- **Site** = a config entry + a tag namespace: `site:<key>` in `Product.tags`.

## Revenue vs Content

- Content (products/deals) is stored in DB (`Product`, `Deal`).
- Revenue is derived from internal events (`ClickEvent`) + provider configs; no external analytics required.
