# Ops & Automation (Auto-generated)

Generated: 2026-01-15T05:34:05.182Z

## Automation flows

- Hourly runner: `apps/worker/src/jobs/hourly.ts`
  - ingestion: `apps/worker/src/ingestion/pipeline.ts`
  - site routing: `apps/worker/src/sites/router.ts`
- Daily runner (placeholder/AI): `apps/worker/src/jobs/daily.ts`

## Ingestion sources

- Seed source: `apps/worker/src/ingestion/sources/seed.ts`
- Source-agnostic contracts: `packages/shared/src/ingestion.ts`

## Monetization

- Redirect logging:
  - `apps/web/app/out/amazon/[asin]/route.ts`
  - `apps/web/app/out/[provider]/[asin]/route.ts`
- Impression tracking:
  - `apps/web/app/api/track/route.ts`

## Monitoring surfaces (admin)

- `/admin` (dashboard + DB status panels)
- `/admin/revenue` (estimated revenue + provider/section)
- `/admin/intelligence` (cross-site learning)
- `/admin/portfolio` (portfolio control)
- `/admin/exit` (exit-grade reporting)
