import { getNetworkLoopHealth } from '@/src/server/admin/network';
import { formatMoney } from '@/src/lib/format';

function pct(x: number | null) {
  if (x == null) return '—';
  return `${(x * 100).toFixed(1)}%`;
}

function centsToUsd(cents: number) {
  return formatMoney(cents, 'USD');
}

export default async function AdminNetworkPage() {
  const report = await getNetworkLoopHealth({ days: 14 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Network</h1>
        <p className="mt-1 text-sm text-slate-600">
          Primary flywheel: partners → clicks → signals → better surfaced deals → partner yield → more partners.
        </p>
        <div className="mt-2 text-xs text-slate-500">
          Window: last {report.window.days}d (7d vs prior 7d comparisons)
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Participation</div>
          <div className="mt-1 text-sm text-slate-700">
            Active partners (≥5 clicks / 7d):{' '}
            <span className="font-semibold tabular-nums">{report.participation.activePartners7d}</span> /{' '}
            <span className="tabular-nums">{report.participation.configuredPartners}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Growth vs prior 7d: {pct(report.participation.activePartnersGrowthPct)}</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Quality</div>
          <div className="mt-1 text-sm text-slate-700">
            Partner CTR (7d): <span className="font-semibold tabular-nums">{(report.quality.ctr7d * 100).toFixed(2)}%</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">CTR Δ: {pct(report.quality.ctrGrowthPct)}</div>
          <div className="mt-2 text-xs text-slate-600">
            Governance: throttled <span className="tabular-nums">{report.quality.governance.throttledPartners}</span>, suspended{' '}
            <span className="tabular-nums">{report.quality.governance.suspendedPartners}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Yield</div>
          <div className="mt-1 text-sm text-slate-700">
            Est. revenue (7d): <span className="font-semibold tabular-nums">{centsToUsd(report.yield.estRevenueCents7d)}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Revenue Δ: {pct(report.yield.revenueGrowthPct)}</div>
          <div className="mt-2 text-xs text-slate-600">
            Yield/click: <span className="tabular-nums">{report.yield.yieldPerClickCents7d.toFixed(1)}¢</span> (Δ {pct(report.yield.yieldPerClickGrowthPct)})
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-xs text-slate-500">Latency</div>
        <div className="mt-1 text-sm text-slate-700">
          Last ingestion: <span className="font-mono text-xs">{report.latency.lastIngestion?.finishedAt?.toISOString() ?? '—'}</span>
          {report.latency.lastIngestionAgeMinutes != null ? (
            <span className="text-xs text-slate-500"> · {report.latency.lastIngestionAgeMinutes}m ago</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

