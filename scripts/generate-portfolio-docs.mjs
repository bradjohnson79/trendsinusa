import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

function toMarkdownTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map((c) => String(c).replace(/\n/g, ' ')).join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

async function main() {
  const root = process.cwd();
  const sitesPath = path.join(root, 'config', 'sites.json');
  const raw = await readFile(sitesPath, 'utf8');
  const { sites, version } = JSON.parse(raw);
  if (version !== 1) throw new Error(`Unsupported sites.json version: ${version}`);

  await mkdir(path.join(root, 'docs'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'DATAROOM'), { recursive: true });

  const siteRows = sites.map((s) => [
    s.key,
    s.enabled ? 'yes' : 'no',
    s.domain,
    (s.defaultCategories?.length ? s.defaultCategories.join(', ') : 'ALL'),
    (s.affiliatePriorities?.length ? s.affiliatePriorities.join(' > ') : 'AMAZON'),
    (s.overrides?.heroTone ?? 'neutral'),
  ]);

  const portfolioMd = `# Portfolio Summary (Auto-generated)

Generated: ${new Date().toISOString()}

This repo is designed as a **multi-site portfolio** with one shared engine:
- **Config**: \`config/sites.json\`
- **Platform core**: monorepo code under \`apps/\` and \`packages/\`
- **Per-site overrides**: \`sites[].overrides\` in config (no code forks)

## Site Registry

${toMarkdownTable(
  ['key', 'enabled', 'domain', 'defaultCategories', 'affiliatePriorities', 'heroTone'],
  siteRows,
)}

## Data Sources (Internal)

- **Traffic proxy**: \`ClickEvent\` rows
  - impressions: \`href = "event://impression"\`
  - outbound clicks: \`referrer event=affiliate_click\`
  - site attribution: \`referrer site=<SITE_KEY>\`
- **Revenue proxy**: estimated from outbound clicks using static EPC assumptions per provider (see admin pages).
- **Content inventory**:
  - products routed to a site via \`Product.tags\` containing \`site:<key>\`
  - live deals are \`Deal.status in (ACTIVE/EXPIRING_*)\` and \`expiresAt > now\`

## Monetization Model (Internal)

- Central redirect + logging:
  - \`apps/web/app/out/amazon/[asin]/route.ts\`
  - \`apps/web/app/out/[provider]/[asin]/route.ts\`
- Provider selection policy:
  - \`apps/web/src/server/affiliate/linkBuilder.ts\`
  - per-site priority: \`sites[].affiliatePriorities\`

## Automation Flows (Internal)

- Hourly ingestion: \`apps/worker/src/jobs/hourly.ts\`
- Shared ingestion pipeline: \`apps/worker/src/ingestion/pipeline.ts\`
- Site routing (post-ingestion): \`apps/worker/src/sites/router.ts\` (tags products with \`site:<key>\`)

## Exit Readiness Notes

- **Partial divestment**: transfer a subset of \`sites[].key\` and their associated domains + affiliate IDs.
- **Full sale**: transfer repo + DB + \`config/sites.json\` + env secrets (documented separately).
- **Partnership**: enable additional providers via \`AffiliateProviderConfig\` and per-product mappings (no code forks).
`;

  const separationMd = `# Separation Boundaries (Auto-generated)

Generated: ${new Date().toISOString()}

## Config vs Code

- **Config** (\`config/sites.json\`):
  - site identity: key/name/domain
  - routing hints: defaultCategories
  - monetization policy: affiliatePriorities
  - presentation overrides: homepageLayout, heroTone, categoryEmphasis, featuredPlacementRules
- **Code**:
  - ingestion + maintenance: \`apps/worker/\`
  - web UI + redirects + admin: \`apps/web/\`
  - shared contracts/env: \`packages/shared/\`
  - DB schema/client: \`packages/db/\`

## Site vs Platform

- **Platform** = shared engine (ingestion, affiliate builder, admin analytics).
- **Site** = a config entry + a tag namespace: \`site:<key>\` in \`Product.tags\`.

## Revenue vs Content

- Content (products/deals) is stored in DB (\`Product\`, \`Deal\`).
- Revenue is derived from internal events (\`ClickEvent\`) + provider configs; no external analytics required.
`;

  await writeFile(path.join(root, 'docs', 'PORTFOLIO.md'), portfolioMd, 'utf8');
  await writeFile(path.join(root, 'docs', 'SEPARATION.md'), separationMd, 'utf8');

  const architectureMd = `# System Architecture (Auto-generated)

Generated: ${new Date().toISOString()}

## High-level

- Monorepo (pnpm + turbo)
- Web app: Next.js App Router (\`apps/web\`)
- Worker: cron-compatible jobs (\`apps/worker\`)
- DB: PostgreSQL + Prisma (\`packages/db\`)
- Shared contracts + config loader (\`packages/shared\`)

## Diagram (Mermaid)

\`\`\`mermaid
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
\`\`\`

## Key boundaries (sale-friendly)

- **Site vs platform**: a site is a config entry + \`Product.tags\` namespace (\`site:<key>\`)
- **Config vs code**: per-site overrides live in \`config/sites.json\`; core engine lives in code
- **Revenue vs content**: revenue is derived from \`ClickEvent\`; content is \`Product\` + \`Deal\`
`;

  const opsMd = `# Ops & Automation (Auto-generated)

Generated: ${new Date().toISOString()}

## Automation flows

- Hourly runner: \`apps/worker/src/jobs/hourly.ts\`
  - ingestion: \`apps/worker/src/ingestion/pipeline.ts\`
  - site routing: \`apps/worker/src/sites/router.ts\`
- Daily runner (placeholder/AI): \`apps/worker/src/jobs/daily.ts\`

## Ingestion sources

- Seed source: \`apps/worker/src/ingestion/sources/seed.ts\`
- Source-agnostic contracts: \`packages/shared/src/ingestion.ts\`

## Monetization

- Redirect logging:
  - \`apps/web/app/out/amazon/[asin]/route.ts\`
  - \`apps/web/app/out/[provider]/[asin]/route.ts\`
- Impression tracking:
  - \`apps/web/app/api/track/route.ts\`

## Monitoring surfaces (admin)

- \`/admin\` (dashboard + DB status panels)
- \`/admin/revenue\` (estimated revenue + provider/section)
- \`/admin/intelligence\` (cross-site learning)
- \`/admin/portfolio\` (portfolio control)
- \`/admin/exit\` (exit-grade reporting)
`;

  const risksMd = `# Technical Risk Audit (Auto-generated)

Generated: ${new Date().toISOString()}

## Single points of failure

- **Database**: single Postgres instance (\`DATABASE_URL\`). If it’s down, both web + worker degrade.
- **Worker scheduling**: relies on cron execution environment (external scheduler / platform cron).

## Vendor dependencies

- **Neon/Postgres** (DB hosting)
- **Amazon outbound** (monetization via affiliate links)
- **OpenAI** (optional / future automation; can be disabled via env)

## Compliance exposure (high-level)

- Affiliate disclosures: present in footer; verify per-site domains.
- Click tracking: stores user-agent + referrer params; no raw IPs stored by design.
- AI content: logged to DB; ensure prompts/outputs are reviewable.

## Notes

- This is a static checklist. Final compliance review should be done by counsel for any transaction.
`;

  const dataRoomReadme = `# Data Room Artifacts (Auto-generated)

Generated: ${new Date().toISOString()}

This folder is designed to be shareable in a transaction.

## Included (static)

- \`docs/PORTFOLIO.md\`
- \`docs/SEPARATION.md\`
- \`docs/DATAROOM/ARCHITECTURE.md\`
- \`docs/DATAROOM/OPS.md\`
- \`docs/DATAROOM/RISKS.md\`
- \`docs/DATAROOM/LICENSING.md\`
- \`docs/DATAROOM/ONBOARDING.md\`
- \`docs/DATAROOM/PARTNERSHIPS.md\`
- \`docs/DATAROOM/PARTNER_API.md\`
- \`docs/DATAROOM/WHITE_LABEL.md\`
- \`docs/DATAROOM/INTELLIGENCE_LAYER.md\`
- \`docs/DATAROOM/ECOSYSTEM_ECONOMICS.md\`
- \`docs/DATAROOM/GOVERNANCE.md\`
- \`docs/DATAROOM/NETWORK_EFFECT.md\`
- \`docs/DATAROOM/STEWARDSHIP.md\`
- \`docs/DATAROOM/STEWARD_SAFEGUARDS.md\`
- \`docs/DATAROOM/STEWARD_PLAYBOOKS.md\`
- \`docs/DATAROOM/SUCCESSION.md\`
- \`docs/DATAROOM/DEPENDENCY_DECOUPLING.md\`
- \`docs/DATAROOM/DATA_MOAT.md\`
- \`docs/DATAROOM/INSTITUTIONAL_DOCTRINE.md\`
- \`docs/DATAROOM/GOVERNANCE_BOUNDARIES.md\`
- \`docs/DATAROOM/OPS_PLAYBOOKS_EXTENDED.md\`
- \`docs/DATAROOM/LONG_HORIZON_STEWARDSHIP.md\`

## Metrics export

Use the admin dashboards:
- \`/admin/portfolio\` (site-level traffic/revenue/growth)
- \`/admin/exit\` (MoM growth + dependency ratios)

If you want files for the data room, run the export script (if present):
- \`pnpm exit:export\`
`;

  await writeFile(path.join(root, 'docs', 'DATAROOM', 'ARCHITECTURE.md'), architectureMd, 'utf8');
  await writeFile(path.join(root, 'docs', 'DATAROOM', 'OPS.md'), opsMd, 'utf8');
  await writeFile(path.join(root, 'docs', 'DATAROOM', 'RISKS.md'), risksMd, 'utf8');
  await writeFile(path.join(root, 'docs', 'DATAROOM', 'README.md'), dataRoomReadme, 'utf8');

  console.log('Wrote docs/PORTFOLIO.md, docs/SEPARATION.md, and docs/DATAROOM/*');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

