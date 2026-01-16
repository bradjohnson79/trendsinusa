# Licensing & Platformization (Internal)

This document defines **license-safe surfaces** for the platform (white-label / resale readiness).

## Goals

- One shared core engine (no forks)
- Strict boundaries between:
  - platform code vs site configuration
  - monetization logic vs provider configuration
  - branding/domain vs data + automation

## What is configurable (licensee-controlled)

### Site registry (config)

File: `config/sites.json`

Per site:
- **Identity**: `key`, `name`, `domain`, `enabled`
- **Branding tokens**: `branding.primaryColor`, `branding.accentColor`, `branding.logoUrl`
- **Routing**: `defaultCategories` (and tag-based routing via `Product.tags`)
- **Monetization policy**: `affiliatePriorities` (provider allowlist + ordering)
- **Presentation overrides**: `overrides.*`
  - homepage layout: `overrides.homepageLayout`
  - hero tone: `overrides.heroTone`
  - category emphasis: `overrides.categoryEmphasis`
  - premium rules: `overrides.featuredPlacementRules`

### Provider configuration (DB, admin-controlled)

Licensees can enable/disable providers and set IDs via admin:
- `/admin/affiliate-settings`

Notes:
- Provider templates are allowed, but **platform keeps the redirect/logging layer fixed**.

## What is fixed (platform-controlled)

- **Core ingestion pipeline** (`apps/worker/src/ingestion/pipeline.ts`)
- **Core automation wiring** (`apps/worker/src/jobs/*`)
- **Affiliate selection logic shape** (platform enforces policy; config only changes priority/availability)
- **Tracking + metrics schema** (events stored in `ClickEvent`)
- **Admin auth + session security**

## License-safe constraints (anti-abuse)

### Rate limiting

Applied on:
- `/api/track` (impression tracking)
- `/out/*` (affiliate redirects)

Implementation is intentionally minimal and auditable:
- in-memory fixed window counters
- documented as a **hook** (multi-instance deployments should swap to a shared store)

### Provider usage boundary

`/out/[provider]/[asin]` is constrained by:
- site allowlist: `sites[].affiliatePriorities` (lowercase comparison)
- provider must also be configured/enabled in DB to become active

## Compliance & privacy notes

- No raw IP stored in DB.
- `ClickEvent` stores:
  - `userAgent` (optional)
  - `referrer` params (contains `site`, `section`, variants, provider)

## Update cadence & compatibility

- Config schema changes should be additive.
- Avoid forking; introduce new config keys under `sites[].overrides.*`.

