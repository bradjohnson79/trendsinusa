import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '@trendsinusa/db';

function monthKey(d) {
  return d.toISOString().slice(0, 7);
}

function parseReferrer(referrer) {
  const sp = new URLSearchParams(referrer ?? '');
  return {
    event: sp.get('event') ?? 'unknown',
    section: sp.get('section') ?? 'unknown',
    site: sp.get('site') ?? 'unknown',
    provider: (sp.get('provider') ?? 'amazon').toLowerCase(),
  };
}

const EPC_CENTS = { amazon: 12, walmart: 10, target: 10 };
const epc = (p) => EPC_CENTS[p] ?? 0;

function streamFromSection(section) {
  if (section.includes('sponsored')) return 'sponsored';
  if (section.includes('premium')) return 'premium';
  if (section === 'unknown') return 'unknown';
  return 'organic';
}

function pct(v) {
  if (v == null) return null;
  return Math.round(v * 1000) / 10;
}

async function main() {
  const months = Number(process.env.EXIT_REPORT_MONTHS ?? '12');
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - (months - 1));

  const events = await prisma.clickEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { occurredAt: true, href: true, referrer: true },
    take: 250000,
    orderBy: { occurredAt: 'desc' },
  });

  const monthly = new Map(); // month -> site -> {imps, clicks, rev, byProvider, byStream}

  for (const e of events) {
    const m = monthKey(e.occurredAt);
    const meta = parseReferrer(e.referrer);
    const site = meta.site;
    const perMonth = monthly.get(m) ?? new Map();
    const row = perMonth.get(site) ?? { imps: 0, clicks: 0, rev: 0, byProvider: {}, byStream: {} };

    if (e.href === 'event://impression') {
      row.imps += 1;
      perMonth.set(site, row);
      monthly.set(m, perMonth);
      continue;
    }
    if (meta.event !== 'affiliate_click') continue;

    row.clicks += 1;
    const cents = epc(meta.provider);
    row.rev += cents;
    row.byProvider[meta.provider] = (row.byProvider[meta.provider] ?? 0) + cents;
    const stream = streamFromSection(meta.section);
    row.byStream[stream] = (row.byStream[stream] ?? 0) + cents;

    perMonth.set(site, row);
    monthly.set(m, perMonth);
  }

  const axis = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 0, 0, 0));
    axis.push(monthKey(d));
  }

  const sites = Array.from(
    axis.flatMap((m) => Array.from((monthly.get(m) ?? new Map()).keys())),
  ).sort();
  const uniqSites = Array.from(new Set(sites));

  const portfolio = axis.map((m) => {
    let imps = 0;
    let clicks = 0;
    let rev = 0;
    for (const s of uniqSites) {
      const row = monthly.get(m)?.get(s);
      if (!row) continue;
      imps += row.imps;
      clicks += row.clicks;
      rev += row.rev;
    }
    return { month: m, impressions: imps, clicks, ctr: imps > 0 ? clicks / imps : 0, estRevenueCents: rev, estRevPerVisitorCents: imps > 0 ? rev / imps : 0 };
  });

  const mom = portfolio.map((r, idx) => {
    const prev = portfolio[idx - 1] ?? null;
    return {
      month: r.month,
      clicksMomPct: prev && prev.clicks > 0 ? pct((r.clicks - prev.clicks) / prev.clicks) : null,
      revMomPct: prev && prev.estRevenueCents > 0 ? pct((r.estRevenueCents - prev.estRevenueCents) / prev.estRevenueCents) : null,
    };
  });

  const out = {
    generatedAt: new Date().toISOString(),
    since: since.toISOString(),
    assumptions: {
      epcCentsByProvider: EPC_CENTS,
      visitorDefinition: 'visitor_proxy=impression',
      normalizedSignals: ['impression', 'affiliate_click'],
    },
    portfolio,
    mom,
    monthlyBySite: axis.map((m) => ({
      month: m,
      sites: Object.fromEntries(Array.from((monthly.get(m) ?? new Map()).entries())),
    })),
  };

  const root = process.cwd();
  const dir = path.join(root, 'docs', 'DATAROOM');
  await mkdir(dir, { recursive: true });

  await writeFile(path.join(dir, 'EXIT_REPORT.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');

  const md = `# Exit Report Export

Generated: ${out.generatedAt}
Since: ${out.since}

## Assumptions

- EPC cents by provider: ${JSON.stringify(EPC_CENTS)}
- Visitor definition: ${out.assumptions.visitorDefinition}
- Normalized signals: ${out.assumptions.normalizedSignals.join(', ')}

## Portfolio monthly

| month | impressions | clicks | ctr% | estRevenueCents | estRevPerVisitorCents |
| --- | ---: | ---: | ---: | ---: | ---: |
${out.portfolio
  .map((r) => `| ${r.month} | ${r.impressions} | ${r.clicks} | ${(r.ctr * 100).toFixed(1)} | ${Math.round(r.estRevenueCents)} | ${Math.round(r.estRevPerVisitorCents)} |`)
  .join('\n')}

## MoM

| month | clicksMoM% | revenueMoM% |
| --- | ---: | ---: |
${out.mom
  .map((r) => `| ${r.month} | ${r.clicksMomPct ?? '—'} | ${r.revMomPct ?? '—'} |`)
  .join('\n')}
`;

  await writeFile(path.join(dir, 'EXIT_REPORT.md'), md, 'utf8');
  console.log('Wrote docs/DATAROOM/EXIT_REPORT.json and docs/DATAROOM/EXIT_REPORT.md');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

