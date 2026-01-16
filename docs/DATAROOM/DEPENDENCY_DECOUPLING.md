# Dependency Decoupling (Execution) — Internal

Objective: ensure critical external dependencies are **replaceable** without refactoring business logic.

This phase adds:
- a documented dependency audit (failure modes + substitution paths)
- missing interface boundaries (where feasible)
- admin-visible dependency health + concentration indicators

## 1) Audit of critical dependencies

### Infrastructure providers

#### PostgreSQL provider (Neon today)
- **Used by**: Prisma (`DATABASE_URL`, `DATABASE_DIRECT_URL`)
- **Failure scenarios**:
  - auth failure / rotated credentials
  - pooler saturation / connection limits
  - region outage
  - schema drift / migrations not applied
- **Blast radius**: public pages degrade to empty states; admin pages may show “needs migration”; ingestion fails.
- **Substitution path**:
  - move `DATABASE_URL` to another Postgres provider (RDS, Supabase, Crunchy, self-hosted)
  - keep Prisma schema/migrations as portability boundary

#### Hosting/runtime (Node + Next.js)
- **Failure scenarios**: deployment rollback needed, cold starts, edge/runtime constraints
- **Substitution path**: keep server code compatible with Node 20+; avoid provider-specific SDKs in core.

### Traffic sources

#### Search/social/referral (external)
- Not directly represented in code; treat as **portfolio risk**.
- **Substitution path**: diversify via multi-site, partner distribution, and programmatic SEO pages (already supported).

### Revenue providers

#### Affiliate providers (Amazon primary, others supported)
- **Used by**: `/out/*` redirect + click logging; provider URL builders
- **Failure scenarios**:
  - Amazon tag disabled/missing → outbound monetization blocked/degraded
  - provider policy change
- **Substitution path**:
  - multi-affiliate engine (`AffiliateProviderConfig`, provider templates)
  - provider-priority routing in config (no hard-coded tags)

### Data sources

#### Ingestion sources
- Seed today; future sources will be adapters
- **Failure scenarios**: source outage, schema changes, rate limits
- **Substitution path**: add new ingestion source modules behind a contract (`IngestedProduct`/`IngestedDeal`).

### Tooling vendors

#### OpenAI (text/image generation)
- **Used by**: server-only OpenAI clients (web + worker)
- **Failure scenarios**: key missing, quota/rate limit, model deprecation
- **Blast radius**: AI content generation fails; platform remains functional.
- **Substitution path**:
  - keep AI provider behind a single “provider adapter” surface (future), storing outputs in DB (already done)

## 2) Health indicators + concentration tracking (admin)

Admin view: `/admin/dependencies`
- DB readiness (migration state)
- ingestion freshness/failures (24h)
- OpenAI key presence + AI failures (24h)
- affiliate configuration readiness
- **partner concentration** (top partner share of partner-attributed clicks)
- **revenue provider concentration** (top affiliate provider share of clicks)

These indicators are **read-only** (no automatic enforcement changes in this phase).

