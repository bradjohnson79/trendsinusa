# System Architecture (Auto-generated)

Generated: 2026-01-15T05:34:05.182Z

## High-level

- Monorepo (pnpm + turbo)
- Web app: Next.js App Router (`apps/web`)
- Worker: cron-compatible jobs (`apps/worker`)
- DB: PostgreSQL + Prisma (`packages/db`)
- Shared contracts + config loader (`packages/shared`)

## Diagram (Mermaid)

```mermaid
flowchart LR
  subgraph Web[apps/web (Next.js)]
    Public[Public pages]
    Admin[Admin pages]
    Track[/api/track POST/]
    Out[/out/* redirects/]
  end

  subgraph Worker[apps/worker]
    Hourly[hourly job]
    Ingest[ingestion pipeline]
    Route[site routing (tags)]
  end

  subgraph DB[(Postgres)]
    Product[Product]
    Deal[Deal]
    ClickEvent[ClickEvent]
    IngestionRun[IngestionRun]
    AffiliateCfg[AffiliateConfig + ProviderConfig]
    Placements[DealPlacement]
  end

  Public --> Track --> ClickEvent
  Public --> Out --> ClickEvent
  Admin --> DB
  Hourly --> Ingest --> Product
  Ingest --> Deal
  Ingest --> IngestionRun
  Hourly --> Route --> Product
  Public --> DB
```

## Key boundaries (sale-friendly)

- **Site vs platform**: a site is a config entry + `Product.tags` namespace (`site:<key>`)
- **Config vs code**: per-site overrides live in `config/sites.json`; core engine lives in code
- **Revenue vs content**: revenue is derived from `ClickEvent`; content is `Product` + `Deal`
