# trendsinusa.com — Monorepo Scaffold

Modern, production-ready monorepo scaffold for **trendsinusa.com**.

## Structure

- `apps/web`: Next.js (App Router) frontend
- `apps/worker`: Background automation jobs (hourly/daily/deal lifecycle)
- `packages/db`: Prisma schema + database client (PostgreSQL)
- `packages/shared`: Shared TypeScript types + env helpers

## Requirements

- Node **20+**
- pnpm **9+**
- PostgreSQL (for Prisma)

## Setup

1. Create your env file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pnpm install
```

3. Generate Prisma client:

```bash
pnpm prisma:generate
```

## Vercel / CI note (Prisma)

- Prisma schema lives at `packages/db/prisma/schema.prisma`
- **Prisma Client is generated during install** (`postinstall`) via `pnpm --filter @trendsinusa/db prisma:generate`
- To fully silence Prisma’s implicit `@prisma/client` postinstall behavior in monorepos, set:
  - `PRISMA_SKIP_POSTINSTALL_GENERATE=true` (in Vercel env vars for Production + Preview)
- **Prisma migrations are not run during Vercel builds**. Run migrations manually (or via CI) using:

```bash
pnpm prisma:migrate:deploy
```

## Run (local)

This repo uses a single **root** `.env`. Package scripts automatically load it.

Run everything in parallel (web + worker + shared/db watchers):

```bash
pnpm dev
```

Run just the web app:

```bash
pnpm --filter @trendsinusa/web dev
```

The web app runs on `http://localhost:3005` by default.

Run just the worker:

```bash
pnpm --filter @trendsinusa/worker dev
```

## Cron-compatible hourly automation

Run one hourly maintenance cycle (ingestion refresh + expiration sweep + state re-eval):

```bash
pnpm --filter @trendsinusa/worker run:hourly
```

Run one daily AI cycle (hero headline + banner copy/image + deal microcopy):

```bash
pnpm --filter @trendsinusa/worker run:daily
```

## Common commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

