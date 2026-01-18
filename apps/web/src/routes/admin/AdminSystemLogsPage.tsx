import { AdminEmptyState, AdminError, AdminLoading, AdminSection, useHumanErrorMessage } from '@/components/admin/AdminPrimitives';
import { useAdminPage } from '@/hooks/admin/useAdminPage';
import { api, ApiClientError } from '@/lib/api';

export function AdminSystemLogsPage() {
  const q = useAdminPage('/system-logs');
  const errMsg = useHumanErrorMessage(q.error);
  const raw = q.data?.data as unknown;
  const alerts =
    raw && typeof raw === 'object' && raw !== null && Array.isArray((raw as any).alerts) ? ((raw as any).alerts as any[]) : [];
  const ingestionRuns =
    raw && typeof raw === 'object' && raw !== null && Array.isArray((raw as any).ingestionRuns)
      ? ((raw as any).ingestionRuns as any[])
      : [];
  const ingestionPreview =
    raw && typeof raw === 'object' && raw !== null && (raw as any).ingestionPreview && typeof (raw as any).ingestionPreview === 'object'
      ? ((raw as any).ingestionPreview as any)
      : null;
  const previewRuns = ingestionPreview && Array.isArray(ingestionPreview.runs) ? (ingestionPreview.runs as any[]) : [];

  return (
    <AdminSection title="System & Logs" description="System logs and audit trails.">
      {q.loading ? <AdminLoading /> : null}
      {q.error ? <AdminError message={errMsg} onRetry={q.reload} /> : null}

      {!q.loading && !q.error ? (
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium text-slate-900">Alerts</div>
            {alerts.length ? (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Severity</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Message</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={String(a.id ?? Math.random())} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-mono text-xs">{String(a.severity ?? '—')}</td>
                        <td className="px-3 py-2 font-mono text-xs">{String(a.type ?? '—')}</td>
                        <td className="px-3 py-2">{String(a.message ?? '—')}</td>
                        <td className="px-3 py-2 font-mono text-xs">{String(a.createdAt ?? '—')}</td>
                        <td className="px-3 py-2 font-mono text-xs">{String(a.resolvedAt ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmptyState title="No alerts yet" description="No alerts have been returned by the API." />
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-slate-900">Ingestion runs</div>
            {ingestionRuns.length ? (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Started</th>
                      <th className="px-3 py-2">Finished</th>
                      <th className="px-3 py-2">Products</th>
                      <th className="px-3 py-2">Deals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingestionRuns.map((r) => (
                      <tr key={String(r.id ?? Math.random())} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-mono text-xs">{String(r.source ?? '—')}</td>
                        <td className="px-3 py-2 font-mono text-xs">{String(r.status ?? '—')}</td>
                        <td className="px-3 py-2 font-mono text-xs">{String(r.startedAt ?? '—')}</td>
                        <td className="px-3 py-2 font-mono text-xs">{String(r.finishedAt ?? '—')}</td>
                        <td className="px-3 py-2 tabular-nums">{Number(r.productsProcessed ?? 0)}</td>
                        <td className="px-3 py-2 tabular-nums">{Number(r.dealsProcessed ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmptyState title="No ingestion history yet" description="No ingestion runs have been returned by the API." />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-900">Ingestion Preview</div>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                disabled={q.loading}
                onClick={async () => {
                  try {
                    await api.admin.ingestionPreview.runAmazonDryRun();
                    await q.reload();
                  } catch (e: unknown) {
                    // eslint-disable-next-line no-alert
                    alert(e instanceof ApiClientError ? e.message : 'Failed to run ingestion preview');
                  }
                }}
              >
                Run Amazon dry run
              </button>
            </div>

            {previewRuns.length ? (
              <div className="mt-2 space-y-3">
                {previewRuns.map((r) => (
                  <div key={String(r.id ?? Math.random())} className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 p-3 text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                      <div>
                        Run: <span className="font-mono">{String(r.id)}</span>
                      </div>
                      <div>
                        Provider: <span className="font-mono">{String(r.provider ?? '—')}</span>
                      </div>
                      <div>
                        OK: <span className="font-mono">{String(r.ok)}</span>
                      </div>
                      <div>
                        Started: <span className="font-mono">{String(r.startedAt ?? '—')}</span>
                      </div>
                      <div>
                        Finished: <span className="font-mono">{String(r.finishedAt ?? '—')}</span>
                      </div>
                    </div>
                    <div className="p-3">
                      {Array.isArray(r.errors) && r.errors.length ? (
                        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
                          Errors: {r.errors.map((x: any) => String(x)).join(' · ')}
                        </div>
                      ) : null}

                      {Array.isArray(r.items) && r.items.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="text-xs text-slate-500">
                              <tr>
                                <th className="py-2 pr-4">ASIN</th>
                                <th className="py-2 pr-4">Status</th>
                                <th className="py-2 pr-4">AI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.items.map((it: any, idx: number) => (
                                <tr key={String(it.asin ?? idx)} className="border-t border-slate-200">
                                  <td className="py-2 pr-4 font-mono text-xs">{String(it.asin ?? '—')}</td>
                                  <td className="py-2 pr-4 text-xs">{it.error ? `error: ${String(it.error)}` : 'ok'}</td>
                                  <td className="py-2 pr-4 text-xs">{it.ai?.ok ? 'ok' : it.ai ? `error: ${String(it.ai.error ?? 'failed')}` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <AdminEmptyState title="No preview items" description="No preview items were returned for this run." />
                      )}

                      {Array.isArray(r.items) && r.items.length ? (
                        <div className="mt-3 space-y-2">
                          {r.items.map((it: any, idx: number) => (
                            <details key={`${String(it.asin ?? idx)}:details`} className="rounded-md border border-slate-200 p-2">
                              <summary className="cursor-pointer text-xs text-slate-700">
                                {String(it.asin ?? 'item')} — {it.normalized?.title ? String(it.normalized.title) : '—'}
                              </summary>
                              <div className="mt-2 grid grid-cols-1 gap-2">
                                <div>
                                  <div className="text-[11px] text-slate-500">Raw Amazon payload</div>
                                  <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[11px] text-slate-800">
                                    {JSON.stringify(it.rawAmazon ?? null, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <div className="text-[11px] text-slate-500">Normalized product</div>
                                  <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[11px] text-slate-800">
                                    {JSON.stringify(it.normalized ?? null, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <div className="text-[11px] text-slate-500">AI enrichment</div>
                                  <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[11px] text-slate-800">
                                    {JSON.stringify(it.ai ?? null, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2">
                <AdminEmptyState
                  title="No ingestion previews yet"
                  description="Run an Amazon dry run to fetch a small sample, normalize it, and run AI enrichment without writing to the database."
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AdminSection>
  );
}

