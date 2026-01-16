# Technical Onboarding (Internal / Licensee)

## Requirements

- Node.js (>= 20)
- pnpm
- PostgreSQL database (Neon or equivalent)

## Setup (repo)

1) Install deps:

```bash
pnpm install
```

2) Configure env:

- Root `.env` is used for apps.
- `packages/db/.env` must contain `DATABASE_URL` (+ optional `DATABASE_DIRECT_URL`).

3) Run migrations (early dev only if you allow resets):

```bash
pnpm prisma:migrate:deploy
```

4) Start dev:

```bash
pnpm dev
```

Web runs on `localhost:3005` (per web app config).

## Configuration steps (multi-site)

1) Edit `config/sites.json`
- Add site entry (key/name/domain)
- Set `enabled`
- Optionally set `affiliatePriorities` and `overrides.*`

2) Route content to the site
- Products are routed using `Product.tags` with `site:<key>`
- Worker job `apps/worker/src/sites/router.ts` maintains these tags based on config defaults

3) Select active site
- Public runtime selection: `SITE_KEY` env (server) + `NEXT_PUBLIC_SITE_KEY` (client)

## Operational responsibilities

- Ensure worker runs on a schedule (cron)
- Monitor:
  - `/admin/portfolio`
  - `/admin/intelligence`
  - `/admin/exit`
  - `/admin/system-logs`
- Keep provider configs current in `/admin/affiliate-settings`

## Abuse prevention

- Rate limiting exists on:
  - `/api/track`
  - `/out/*`

For multi-instance/serverless deployments, replace in-memory limiter with a shared store.

