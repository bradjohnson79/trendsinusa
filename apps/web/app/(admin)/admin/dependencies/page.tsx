import { getDependencyHealthReport } from '@/src/server/admin/dependencies';

export default async function AdminDependenciesPage() {
  const r = await getDependencyHealthReport({ days: 30 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dependencies</h1>
        <p className="mt-1 text-sm text-slate-600">
          Replaceability + health indicators for critical external dependencies. Read-only; no behavior changes.
        </p>
        <div className="mt-2 text-xs text-slate-500">Generated: {r.generatedAt}</div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Issues</div>
        {r.issues.length === 0 ? (
          <div className="mt-2 text-sm text-slate-600">No issues detected.</div>
        ) : (
          <ul className="mt-2 space-y-2">
            {r.issues.map((i) => (
              <li key={`${i.key}:${i.message}`} className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                <div className="font-mono">{i.severity}</div>
                <div className="mt-1">{i.message}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-900">Infrastructure</div>
          <div className="mt-2 text-sm text-slate-700">
            DB status: <span className="font-mono text-xs">{r.infra.db.status}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-900">Data sources</div>
          <div className="mt-2 text-sm text-slate-700">
            Last ingestion: <span className="font-mono text-xs">{r.dataSources.ingestion.lastIngestion?.finishedAt?.toISOString() ?? '—'}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Failures (24h): {r.dataSources.ingestion.ingestionFailures24h} · age:{' '}
            {r.dataSources.ingestion.lastIngestionAgeMinutes == null ? '—' : `${r.dataSources.ingestion.lastIngestionAgeMinutes}m`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-900">Revenue providers</div>
          <div className="mt-2 text-xs text-slate-700">
            US affiliate config:{' '}
            {r.revenueProviders.affiliateUS?.enabled && r.revenueProviders.affiliateUS.associateTag ? (
              <span className="font-mono">enabled</span>
            ) : (
              <span className="font-mono">disabled/missing</span>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-700">
            Click concentration (30d):{' '}
            {r.revenueProviders.clickConcentration.topProvider ? (
              <span className="font-mono">
                {r.revenueProviders.clickConcentration.topProvider.provider} {Math.round(r.revenueProviders.clickConcentration.topProvider.share * 100)}%
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-900">Partners</div>
          <div className="mt-2 text-xs text-slate-700">
            Configured: <span className="font-mono">{r.partners.configured}</span>
          </div>
          <div className="mt-2 text-xs text-slate-700">
            Partner click concentration (30d):{' '}
            {r.partners.partnerClickConcentration.topPartner ? (
              <span className="font-mono">
                {r.partners.partnerClickConcentration.topPartner.partner} {Math.round(r.partners.partnerClickConcentration.topPartner.share * 100)}%
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

