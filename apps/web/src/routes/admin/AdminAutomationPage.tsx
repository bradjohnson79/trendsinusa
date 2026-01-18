import { useEffect, useState } from 'react';

import type { AdminAiDiagnosticsResponse, AdminAutomationDashboardResponse, AdminDalleDiagnosticsResponse } from '@trendsinusa/shared/api';
import { api, ApiClientError } from '@/lib/api';

function fmtPacific(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

export function AdminAutomationPage() {
  const [data, setData] = useState<AdminAutomationDashboardResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cronDraft, setCronDraft] = useState<Record<string, string>>({});
  const [diagPrompt, setDiagPrompt] = useState('Say hello in one sentence.');
  const [diagQuery, setDiagQuery] = useState('What is TrendsInUSA? (one sentence)');
  const [diag, setDiag] = useState<AdminAiDiagnosticsResponse | null>(null);
  const [dalle, setDalle] = useState<AdminDalleDiagnosticsResponse | null>(null);
  const [providers, setProviders] = useState<any[] | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api.admin
      .automationDashboard(ac.signal)
      .then((r) => setData(r))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErr(e instanceof ApiClientError ? e.message : 'Failed to load automation dashboard');
      });
    api.admin
      .providers
      .list(ac.signal)
      .then((r: any) => setProviders((r as any)?.data?.providers ?? []))
      .catch(() => setProviders([]));
    return () => ac.abort();
  }, []);

  async function refresh() {
    const ac = new AbortController();
    try {
      setData(await api.admin.automationDashboard(ac.signal));
    } catch (e: unknown) {
      setErr(e instanceof ApiClientError ? e.message : 'Failed to refresh');
    }
  }

  const automationEnabled = data?.config.automationEnabled ?? false;
  const discoveryEnabled = data?.config.discoveryEnabled ?? false;
  const unaffiliatedAutoPublishEnabled = data?.publishing?.unaffiliatedAutoPublishEnabled ?? false;

  useEffect(() => {
    if (!data?.schedules) return;
    setCronDraft((prev) => {
      const next = { ...prev };
      for (const s of data.schedules) {
        if (next[s.jobType] == null) next[s.jobType] = s.cron;
      }
      return next;
    });
  }, [data?.schedules]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Automation</h2>
      <p className="text-sm text-slate-700">Automation & AI control plane.</p>
      {err ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}
      {okMsg ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{okMsg}</div> : null}

      {!data ? <div className="text-sm text-slate-600">Loading…</div> : null}

      {data ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Automation controls</div>
            <div className="p-4 flex flex-wrap items-center gap-3">
              <div className="text-sm text-slate-700">
                Status:{' '}
                <span className={automationEnabled ? 'font-medium text-emerald-700' : 'font-medium text-slate-600'}>
                  {automationEnabled ? 'enabled' : 'disabled'}
                </span>
              </div>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                disabled={busy === 'enable' || automationEnabled}
                onClick={async () => {
                  try {
                    setBusy('enable');
                    await api.admin.enableAutomation();
                    await refresh();
                  } catch (ex: unknown) {
                    setErr(ex instanceof ApiClientError ? ex.message : 'Failed to enable automation');
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Enable automation
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                disabled={busy === 'disable' || !automationEnabled}
                onClick={async () => {
                  try {
                    setBusy('disable');
                    await api.admin.disableAutomation();
                    await refresh();
                  } catch (ex: unknown) {
                    setErr(ex instanceof ApiClientError ? ex.message : 'Failed to disable automation');
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Disable automation
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                disabled={busy === 'refresh'}
                onClick={async () => {
                  try {
                    setBusy('refresh');
                    await refresh();
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Refresh
              </button>
            </div>
            <div className="px-4 pb-4 text-xs text-slate-500">
              No background jobs auto-run yet. Manual runs create/cancel command records only.
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Publishing controls</div>
            <div className="p-4 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={unaffiliatedAutoPublishEnabled}
                  disabled={!automationEnabled || busy === 'unaffiliatedAutoPublish'}
                  onChange={async (e) => {
                    try {
                      setErr(null);
                      setOkMsg(null);
                      setBusy('unaffiliatedAutoPublish');
                      await api.admin.setUnaffiliatedAutoPublishEnabled({ enabled: e.currentTarget.checked });
                      await refresh();
                      setOkMsg('Saved.');
                      window.setTimeout(() => setOkMsg(null), 2500);
                    } catch (ex: unknown) {
                      setErr(ex instanceof ApiClientError ? ex.message : 'Failed to save');
                    } finally {
                      setBusy(null);
                    }
                  }}
                />
                Enable unaffiliated auto-publishing
              </label>
              <div className="text-xs text-slate-500">
                When enabled, discovery candidates may be automatically published as non-affiliate posts on schedule. Affiliate credentials are not required.
              </div>
              {!automationEnabled ? <div className="text-xs text-slate-500">Enable automation to modify publishing controls.</div> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Discovery controls</div>
            <div className="p-4 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={discoveryEnabled}
                  disabled={!automationEnabled || busy === 'discoveryEnabled'}
                  onChange={async (e) => {
                    try {
                      setErr(null);
                      setOkMsg(null);
                      setBusy('discoveryEnabled');
                      await api.admin.setDiscoveryEnabled({ enabled: e.currentTarget.checked });
                      await refresh();
                      setOkMsg('Saved.');
                      window.setTimeout(() => setOkMsg(null), 2500);
                    } catch (ex: unknown) {
                      setErr(ex instanceof ApiClientError ? ex.message : 'Failed to save');
                    } finally {
                      setBusy(null);
                    }
                  }}
                />
                Enable Discovery (Trending Source Ingestion)
              </label>
              <div className="text-xs text-slate-500">Controls whether automated discovery sources may ingest new trend candidates.</div>
              <div className="text-xs text-slate-500">✅ Freshness window: Last 24 hours</div>
              <div className="text-xs text-slate-500">🕒 Timezone: UTC (locked)</div>
              <div className="text-xs text-slate-500">🔗 Link verification: ON (fail-closed)</div>
              {!automationEnabled ? <div className="text-xs text-slate-500">Enable automation to modify discovery controls.</div> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Registered jobs</div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Job</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Last run</th>
                    <th className="py-2 pr-4">Last error</th>
                    <th className="py-2 pr-4">Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((j) => (
                    <tr key={j.key} className="border-t border-slate-200">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-slate-900">{j.name}</div>
                        <div className="font-mono text-xs text-slate-600">{j.key}</div>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{j.status}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{j.lastRunAt ?? '—'}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{j.lastError ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                            disabled={busy === `run:${j.key}` || j.status !== 'idle' || !automationEnabled}
                            onClick={async () => {
                              try {
                                setBusy(`run:${j.key}`);
                                await api.admin.runAutomationJob(j.key);
                                await refresh();
                              } catch (ex: unknown) {
                                setErr(ex instanceof ApiClientError ? ex.message : 'Failed to trigger run');
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            Trigger manual run
                          </button>
                          <button
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                            disabled={busy === `cancel:${j.key}` || j.status !== 'running'}
                            onClick={async () => {
                              try {
                                setBusy(`cancel:${j.key}`);
                                await api.admin.cancelAutomationJob(j.key);
                                await refresh();
                              } catch (ex: unknown) {
                                setErr(ex instanceof ApiClientError ? ex.message : 'Failed to cancel job');
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            Cancel running job
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.jobs.length === 0 ? <div className="text-sm text-slate-600">No jobs registered.</div> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Scheduled Runs</div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-slate-500">
                Schedules are explicit and fail-closed. Jobs enqueue SystemCommand records and will not run if required gates are not satisfied.
              </div>
              <div className="text-xs text-slate-500">Timestamps displayed in America/Los_Angeles (Pacific Time).</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Job</th>
                      <th className="py-2 pr-4">Enabled</th>
                      <th className="py-2 pr-4">Cron</th>
                      <th className="py-2 pr-4">Presets</th>
                      <th className="py-2 pr-4">Last scheduled</th>
                      <th className="py-2 pr-4">Next run</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.schedules.map((s) => {
                      const blocked =
                        !automationEnabled ||
                        (s.jobType === 'UNAFFILIATED_PUBLISHER' && !unaffiliatedAutoPublishEnabled) ||
                        s.status === 'blocked';
                      const toggleDisabled =
                        !automationEnabled || (s.jobType === 'UNAFFILIATED_PUBLISHER' && !unaffiliatedAutoPublishEnabled) || busy === `sched:${s.jobType}`;
                      const draft = cronDraft[s.jobType] ?? s.cron;
                      return (
                        <tr key={s.jobType} className="border-t border-slate-200 align-top">
                          <td className="py-2 pr-4">
                            <div className="font-medium text-slate-900">{s.jobType === 'DISCOVERY_SWEEP' ? 'Discovery sweep' : 'Unaffiliated publisher'}</div>
                            <div className="font-mono text-xs text-slate-600">{s.jobType}</div>
                            {s.blockedReason ? <div className="mt-1 text-xs text-amber-700">{s.blockedReason}</div> : null}
                          </td>
                          <td className="py-2 pr-4">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={s.enabled}
                                disabled={toggleDisabled}
                                onChange={async (e) => {
                                  try {
                                    setErr(null);
                                    setOkMsg(null);
                                    setBusy(`sched:${s.jobType}`);
                                    await api.admin.setAutomationSchedule(s.jobType, { enabled: e.currentTarget.checked, cron: draft, timezone: 'UTC' });
                                    await refresh();
                                    setOkMsg('Saved.');
                                    window.setTimeout(() => setOkMsg(null), 2500);
                                  } catch (ex: unknown) {
                                    setErr(ex instanceof ApiClientError ? ex.message : 'Failed to save schedule');
                                  } finally {
                                    setBusy(null);
                                  }
                                }}
                              />
                              {s.enabled ? 'on' : 'off'}
                            </label>
                            {!automationEnabled ? <div className="mt-1 text-xs text-slate-500">Enable automation to edit scheduling.</div> : null}
                            {s.jobType === 'UNAFFILIATED_PUBLISHER' && automationEnabled && !unaffiliatedAutoPublishEnabled ? (
                              <div className="mt-1 text-xs text-amber-700">Auto-publishing disabled</div>
                            ) : null}
                          </td>
                          <td className="py-2 pr-4">
                            <input
                              className="w-56 rounded-md border border-slate-200 px-2 py-1 text-xs font-mono disabled:bg-slate-50"
                              value={draft}
                              disabled={blocked}
                              onChange={(e) => setCronDraft((p) => ({ ...p, [s.jobType]: e.currentTarget.value }))}
                            />
                            <div className="mt-1 text-[11px] text-slate-500">Timezone: {s.timezone}</div>
                          </td>
                          <td className="py-2 pr-4">
                            <select
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                              disabled={blocked}
                              value=""
                              onChange={(e) => {
                                const v = e.currentTarget.value;
                                if (!v) return;
                                setCronDraft((p) => ({ ...p, [s.jobType]: v }));
                              }}
                            >
                              <option value="">Select…</option>
                              <option value="*/15 * * * *">Every 15 minutes</option>
                              <option value="*/30 * * * *">Every 30 minutes</option>
                              <option value="0 * * * *">Hourly</option>
                              <option value="0 */6 * * *">Every 6 hours</option>
                              <option value="0 0 * * *">Daily</option>
                            </select>
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">{fmtPacific(s.lastScheduledAt)}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{fmtPacific(s.nextRunAt)}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{s.status}</td>
                          <td className="py-2 pr-4">
                            <button
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                              disabled={blocked || busy === `schedsave:${s.jobType}`}
                              onClick={async () => {
                                try {
                                  setErr(null);
                                  setOkMsg(null);
                                  setBusy(`schedsave:${s.jobType}`);
                                  await api.admin.setAutomationSchedule(s.jobType, { enabled: s.enabled, cron: draft, timezone: 'UTC' });
                                  await refresh();
                                  setOkMsg('Saved.');
                                  window.setTimeout(() => setOkMsg(null), 2500);
                                } catch (ex: unknown) {
                                  setErr(ex instanceof ApiClientError ? ex.message : 'Failed to save schedule');
                                } finally {
                                  setBusy(null);
                                }
                              }}
                            >
                              Save cron
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.schedules.length === 0 ? <div className="text-sm text-slate-600">No schedules configured.</div> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Diagnostics</div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-slate-600">
                Runs on demand only. Results are not stored in the database.
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-md border border-slate-200 p-3 space-y-2">
                  <div className="text-xs font-medium text-slate-900">OpenAI</div>
                  <textarea
                    className="w-full rounded-md border border-slate-200 p-2 text-sm"
                    rows={3}
                    value={diagPrompt}
                    onChange={(e) => setDiagPrompt(e.target.value)}
                  />
                  <button
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                    disabled={busy === 'diag:openai'}
                    onClick={async () => {
                      try {
                        setBusy('diag:openai');
                        const r = await api.admin.diagnostics.openai(diagPrompt);
                        setDiag(r);
                      } catch (ex: unknown) {
                        setErr(ex instanceof ApiClientError ? ex.message : 'Failed to run OpenAI diagnostic');
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Test OpenAI
                  </button>
                </div>

                <div className="rounded-md border border-slate-200 p-3 space-y-2">
                  <div className="text-xs font-medium text-slate-900">Perplexity</div>
                  <textarea
                    className="w-full rounded-md border border-slate-200 p-2 text-sm"
                    rows={3}
                    value={diagQuery}
                    onChange={(e) => setDiagQuery(e.target.value)}
                  />
                  <button
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                    disabled={busy === 'diag:perplexity'}
                    onClick={async () => {
                      try {
                        setBusy('diag:perplexity');
                        const r = await api.admin.diagnostics.perplexity(diagQuery);
                        setDiag(r);
                      } catch (ex: unknown) {
                        setErr(ex instanceof ApiClientError ? ex.message : 'Failed to run Perplexity diagnostic');
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Test Perplexity
                  </button>
                </div>

                <div className="rounded-md border border-slate-200 p-3 space-y-2">
                  <div className="text-xs font-medium text-slate-900">DALL·E (Images API)</div>
                  <div className="text-xs text-slate-600">
                    Model: <span className="font-mono">gpt-image-1</span> · Size: <span className="font-mono">1024x1024</span>
                  </div>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                    disabled={busy === 'diag:dalle'}
                    onClick={async () => {
                      try {
                        setBusy('diag:dalle');
                        const r = await api.admin.diagnostics.dalle();
                        setDalle(r);
                      } catch (ex: unknown) {
                        setErr(ex instanceof ApiClientError ? ex.message : 'Failed to run DALL·E diagnostic');
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Test image generation
                  </button>
                </div>
              </div>

              {diag ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="text-xs text-slate-600">
                    Provider: <span className="font-mono">{diag.provider}</span> · OK:{' '}
                    <span className="font-mono">{String(diag.ok)}</span> · Model:{' '}
                    <span className="font-mono">{diag.model ?? '—'}</span>
                  </div>
                  {diag.error ? <div className="text-xs text-rose-800">Error: {diag.error}</div> : null}
                  <div className="rounded bg-white p-2 font-mono text-xs text-slate-800 whitespace-pre-wrap">{diag.outputText ?? '—'}</div>
                </div>
              ) : null}

              {dalle ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="text-xs text-slate-600">
                    Success: <span className="font-mono">{String(dalle.success)}</span> · Model:{' '}
                    <span className="font-mono">{dalle.model}</span> · Elapsed:{' '}
                    <span className="font-mono">{dalle.elapsedMs}ms</span>
                  </div>
                  {dalle.error ? (
                    <div className="text-xs text-rose-800">
                      Error: {dalle.error.message}
                      {dalle.error.httpStatus != null ? ` (HTTP ${dalle.error.httpStatus})` : ''}
                      {dalle.error.kind ? ` · kind=${dalle.error.kind}` : ''}
                    </div>
                  ) : null}
                  <div className="text-xs text-slate-700 font-mono">
                    {dalle.image
                      ? `image: ${dalle.image.bytes} bytes · format=${dalle.image.format ?? 'unknown'} · ${dalle.image.width ?? '??'}x${dalle.image.height ?? '??'}`
                      : 'image: —'}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Provider enablement</div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-600">
                Providers are <span className="font-medium">LOCKED</span> if required credentials are missing. Even when READY, an admin toggle is required to ENABLE.
              </div>
              {!providers ? <div className="text-sm text-slate-600">Loading…</div> : null}
              {providers && providers.length === 0 ? <div className="text-sm text-slate-600">No providers configured.</div> : null}
              {providers && providers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Provider</th>
                        <th className="py-2 pr-4">Credentials</th>
                        <th className="py-2 pr-4">Enabled</th>
                        <th className="py-2 pr-4">Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providers.map((p: any) => (
                        <tr key={p.provider} className="border-t border-slate-200">
                          <td className="py-2 pr-4 font-mono text-xs">{p.provider}</td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {p.credentials?.status}
                            {Array.isArray(p.credentials?.missing) && p.credentials.missing.length
                              ? ` (missing: ${p.credentials.missing.join(', ')})`
                              : ''}
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">{String(!!p.enabled)}</td>
                          <td className="py-2 pr-4">
                            <div className="flex gap-2">
                              <button
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                                disabled={busy === `prov:on:${p.provider}`}
                                onClick={async () => {
                                  try {
                                    setBusy(`prov:on:${p.provider}`);
                                    await api.admin.providers.enable(p.provider);
                                    const r: any = await api.admin.providers.list();
                                    setProviders((r as any)?.data?.providers ?? []);
                                  } catch (ex: unknown) {
                                    setErr(ex instanceof ApiClientError ? ex.message : 'Failed to enable provider');
                                  } finally {
                                    setBusy(null);
                                  }
                                }}
                              >
                                Enable
                              </button>
                              <button
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                                disabled={busy === `prov:off:${p.provider}`}
                                onClick={async () => {
                                  try {
                                    setBusy(`prov:off:${p.provider}`);
                                    await api.admin.providers.disable(p.provider);
                                    const r: any = await api.admin.providers.list();
                                    setProviders((r as any)?.data?.providers ?? []);
                                  } catch (ex: unknown) {
                                    setErr(ex instanceof ApiClientError ? ex.message : 'Failed to disable provider');
                                  } finally {
                                    setBusy(null);
                                  }
                                }}
                              >
                                Disable
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">AI runs (24h)</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{data.runs24h}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Avg confidence (24h)</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {data.avgConfidence24h == null ? '—' : data.avgConfidence24h.toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Products generated</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{data.productsWithAI}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Deals AI-featured</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{data.dealsFeatured}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Deals AI-suppressed</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{data.dealsSuppressed}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Visual Assets</div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-slate-600">
                Decorative backgrounds only. Output is pre-sized and stored in asset storage; frontend consumes URLs only.
              </div>

              <form
                className="flex flex-wrap items-center gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const enabled = (e.currentTarget.elements.namedItem('imageGenEnabled') as HTMLInputElement | null)?.checked ?? false;
                  try {
                    setBusy('imageGen');
                    await api.admin.setImageGenEnabled({ enabled });
                    await refresh();
                  } catch (ex: unknown) {
                    setErr(ex instanceof ApiClientError ? ex.message : 'Failed to save');
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="imageGenEnabled" defaultChecked={data.config.imageGenEnabled} />
                  Enable image generation (site: <span className="font-mono text-xs">{data.config.siteKey}</span>)
                </label>
                <button
                  type="submit"
                  disabled={busy === 'imageGen'}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Save
                </button>
              </form>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-xs font-medium text-slate-900">Hero background</div>
                  <div className="mt-1 text-xs text-slate-600">
                    Requested: {data.config.heroRegenerateAt ?? '—'} (processed by worker cron)
                  </div>
                  <button
                    className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                    disabled={busy === 'hero'}
                    onClick={async () => {
                      try {
                        setBusy('hero');
                        await api.admin.requestHeroRegenerate();
                        await refresh();
                      } catch (ex: unknown) {
                        setErr(ex instanceof ApiClientError ? ex.message : 'Failed to queue hero regenerate');
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Regenerate hero image
                  </button>
                </div>

                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-xs font-medium text-slate-900">Category banners</div>
                  <div className="mt-1 text-xs text-slate-600">
                    Requested: {data.config.categoryRegenerateAt ?? '—'} (processed by worker cron)
                  </div>
                  <button
                    className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                    disabled={busy === 'category'}
                    onClick={async () => {
                      try {
                        setBusy('category');
                        await api.admin.requestCategoryRegenerate();
                        await refresh();
                      } catch (ex: unknown) {
                        setErr(ex instanceof ApiClientError ? ex.message : 'Failed to queue category regenerate');
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Regenerate category images
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Errors (non-noisy)</div>
            <div className="p-4">
              {data.errors.length === 0 ? (
                <div className="text-sm text-slate-600">No active errors.</div>
              ) : (
                <ul className="space-y-2">
                  {data.errors.map((a) => (
                    <li key={a.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                      <div className="font-medium">{a.type}</div>
                      <div className="text-slate-600">{a.message}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

