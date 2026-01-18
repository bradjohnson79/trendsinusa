## @trendsinusa/web (Vite)

This package is the **client-only** frontend runtime.

- **No SSR**
- **No server actions**
- **No Prisma / DB access**
- **No worker imports**

If you need data, it must come from a separate API layer (not in this package).

## Vercel deployment (boring on purpose)

- **Framework**: Vite
- **Root directory**: `apps/web`
- **Build command**: `pnpm build`
- **Output directory**: `dist/`
- **SPA routing**: `vercel.json` rewrites all non-`/api/*` paths to `index.html`

### Recommended env vars

- **`VITE_SITE_COUNTRY`**: `usa` | `canada` | `uk` | `australia`
- **`VITE_API_BASE`** (optional): e.g. `https://api.example.com` (defaults to same-origin)
- **`PRISMA_SKIP_POSTINSTALL_GENERATE=1`**: prevents Prisma client generation during install for frontend-only deploys

## Local dev (API on 3005)

If your backend/API is running on **`http://localhost:3005`**, the Vite dev server runs on **`http://localhost:3006`**
and proxies `/api/*` → `http://localhost:3005/api/*`.

