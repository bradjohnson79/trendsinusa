import { getGovernanceReport } from '@/src/server/admin/governance';

export default async function AdminGovernancePage() {
  const report = await getGovernanceReport({ limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Governance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Automated monitoring + progressive enforcement for partner ecosystem participation. No manual policing required.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Partner enforcement state</div>
        <div className="p-4 overflow-x-auto">
          {report.partners.length === 0 ? (
            <div className="text-sm text-slate-600">No partners configured.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Partner</th>
                  <th className="py-2 pr-4">Enabled</th>
                  <th className="py-2 pr-4">Site</th>
                  <th className="py-2 pr-4">Tier</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Open violations</th>
                  <th className="py-2 pr-4">Open critical</th>
                  <th className="py-2 pr-4">Scopes</th>
                </tr>
              </thead>
              <tbody>
                {report.partners.map((p) => (
                  <tr key={p.key} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{p.key}</td>
                    <td className="py-2 pr-4">{p.enabled ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.siteKey}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.tier}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.action}</td>
                    <td className="py-2 pr-4 tabular-nums">{p.openViolations}</td>
                    <td className="py-2 pr-4 tabular-nums">{p.openCritical}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.scopes.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Recent governance alerts</div>
        <div className="p-4 space-y-2">
          {report.alerts.length === 0 ? (
            <div className="text-sm text-slate-600">No governance alerts yet.</div>
          ) : (
            report.alerts.map((a) => (
              <div key={a.id} className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-mono">{a.severity}</span>
                  <span className="font-mono">{a.type}</span>
                  <span className="text-slate-500">{a.createdAt.toISOString()}</span>
                  {a.resolvedAt ? <span className="text-slate-500">resolved</span> : <span className="text-slate-500">open</span>}
                </div>
                <div className="mt-1 font-mono break-words">{a.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

