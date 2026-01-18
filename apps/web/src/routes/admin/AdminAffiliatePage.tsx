import { useEffect, useState } from 'react';

import type { AdminAffiliateProviderConfig, AdminAffiliateResponse, AffiliateProvider } from '@trendsinusa/shared/api';
import { api, ApiClientError } from '@/lib/api';

export function AdminAffiliatePage() {
  const [data, setData] = useState<AdminAffiliateResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api.admin
      .affiliate(ac.signal)
      .then((r) => setData(r))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErr(e instanceof ApiClientError ? e.message : 'Failed to load affiliate settings');
      });
    return () => ac.abort();
  }, []);

  async function refresh() {
    const ac = new AbortController();
    setData(await api.admin.affiliate(ac.signal));
  }

  function providerCfg(provider: AffiliateProvider): AdminAffiliateProviderConfig | null {
    if (!data) return null;
    return data.providerConfigs.find((p) => p.provider === provider) ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Affiliate Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Configure affiliate linking via explicit API calls (cookie-auth via API).</p>
        {data ? (
          <p className="mt-1 text-xs text-slate-500">
            Site: <span className="font-mono">{data.siteKey}</span>
          </p>
        ) : null}
      </div>

      {err ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}
      {!data ? <div className="text-sm text-slate-600">Loading…</div> : null}

      {data ? (
        <>
          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Amazon Associate configuration (US)</div>
            <div className="p-4">
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const enabled = (e.currentTarget.elements.namedItem('enabled') as HTMLInputElement | null)?.checked ?? false;
                  const associateTagRaw =
                    (e.currentTarget.elements.namedItem('associateTag') as HTMLInputElement | null)?.value?.trim() ?? '';
                  const associateTag = associateTagRaw.length ? associateTagRaw : null;
                  try {
                    setBusy('amazon');
                    await api.admin.saveAffiliateSettings({ enabled, associateTag });
                    await refresh();
                  } catch (ex: unknown) {
                    setErr(ex instanceof ApiClientError ? ex.message : 'Failed to save settings');
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" name="enabled" defaultChecked={data.enabled} className="h-4 w-4" />
                  Enable affiliate linking globally
                </label>

                <div>
                  <label className="text-sm font-medium text-slate-800" htmlFor="associateTag">
                    Amazon Associate ID (tag)
                  </label>
                  <input
                    id="associateTag"
                    name="associateTag"
                    type="text"
                    defaultValue={data.associateTag ?? ''}
                    placeholder="yourtag-20"
                    className="mt-1 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-500">Stored server-side. Public outbound links are wrapped dynamically.</p>
                </div>

                <button
                  type="submit"
                  disabled={busy === 'amazon'}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Save
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
              Other affiliate providers (prepared, disabled by default)
            </div>
            <div className="p-4 space-y-6">
              {(['WALMART', 'TARGET'] as const).map((p) => {
                const cfg = providerCfg(p);
                return (
                  <div key={p} className="rounded-md border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">{p}</div>
                    <form
                      className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const enabled = (e.currentTarget.elements.namedItem('providerEnabled') as HTMLInputElement | null)?.checked ?? false;
                        const priorityRaw = (e.currentTarget.elements.namedItem('priority') as HTMLInputElement | null)?.value ?? '';
                        const priority = Number(priorityRaw || 100);
                        const affiliateIdRaw =
                          (e.currentTarget.elements.namedItem('affiliateId') as HTMLInputElement | null)?.value?.trim() ?? '';
                        const affiliateId = affiliateIdRaw.length ? affiliateIdRaw : null;
                        const linkTemplateRaw =
                          (e.currentTarget.elements.namedItem('linkTemplate') as HTMLInputElement | null)?.value?.trim() ?? '';
                        const linkTemplate = linkTemplateRaw.length ? linkTemplateRaw : null;
                        try {
                          setBusy(`provider:${p}`);
                          await api.admin.saveAffiliateProviderConfig({
                            provider: p,
                            enabled,
                            affiliateId,
                            priority: Number.isFinite(priority) ? priority : 100,
                            linkTemplate,
                          });
                          await refresh();
                        } catch (ex: unknown) {
                          setErr(ex instanceof ApiClientError ? ex.message : `Failed to save ${p}`);
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      <label className="flex items-center gap-2 text-sm text-slate-800">
                        <input type="checkbox" name="providerEnabled" defaultChecked={cfg?.enabled ?? false} className="h-4 w-4" />
                        Enable provider
                      </label>

                      <div>
                        <label className="text-sm font-medium text-slate-800" htmlFor={`${p}-priority`}>
                          Priority (lower wins)
                        </label>
                        <input
                          id={`${p}-priority`}
                          name="priority"
                          type="number"
                          defaultValue={cfg?.priority ?? 100}
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-800" htmlFor={`${p}-affiliateId`}>
                          Affiliate ID
                        </label>
                        <input
                          id={`${p}-affiliateId`}
                          name="affiliateId"
                          type="text"
                          defaultValue={cfg?.affiliateId ?? ''}
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-800" htmlFor={`${p}-linkTemplate`}>
                          Link template (optional)
                        </label>
                        <input
                          id={`${p}-linkTemplate`}
                          name="linkTemplate"
                          type="text"
                          defaultValue={cfg?.linkTemplate ?? ''}
                          placeholder="e.g. https://example.com/out?u={{url}}&aff={{affiliateId}}"
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Variables: <code className="rounded bg-slate-100 px-1">{'{{url}}'}</code>,{' '}
                          <code className="rounded bg-slate-100 px-1">{'{{asin}}'}</code>,{' '}
                          <code className="rounded bg-slate-100 px-1">{'{{affiliateId}}'}</code>.
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="submit"
                          disabled={busy === `provider:${p}`}
                          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          Save {p}
                        </button>
                      </div>
                    </form>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Preview</div>
            <div className="p-4 space-y-2">
              <div className="text-xs text-slate-500">Sample URL</div>
              <div className="rounded bg-slate-50 p-2 font-mono text-xs text-slate-800">
                {data.sampleUrl ?? 'https://www.amazon.com/dp/B0C1234567'}
              </div>

              <div className="text-xs text-slate-500">Generated affiliate URL</div>
              {data.preview?.ok ? (
                <div className="rounded bg-slate-50 p-2 font-mono text-xs text-slate-800 break-all">{data.preview.url}</div>
              ) : (
                <div className="rounded bg-amber-50 p-2 text-xs text-amber-900">
                  Affiliate links are blocked ({data.preview?.reason ?? 'unknown'}).
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

