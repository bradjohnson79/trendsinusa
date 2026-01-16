# `@trendsinusa/db` (Prisma)

## Vercel + Turborepo note

In Vercel installs, Prisma’s internal `@prisma/client` postinstall hook can try to locate a schema and emit noisy warnings in monorepos.

Set this environment variable in **Vercel** (Production + Preview):

```
PRISMA_SKIP_POSTINSTALL_GENERATE=true
```

This disables Prisma’s implicit postinstall generation. We then generate Prisma Client **explicitly** via the repo root `postinstall` script:

```
pnpm --filter @trendsinusa/db prisma:generate
```

## Migrations

Prisma migrations are **not** run during Vercel builds. Run them manually or via CI using:

```
pnpm prisma:migrate:deploy
```

