import { buildAmazonAffiliateUrl } from '@trendsinusa/shared';

import { getAffiliateConfigUS } from '@/src/server/affiliate/config';
import { getAdminDbStatus } from '@/src/server/admin/dbStatus';
import { prisma } from '@/src/server/prisma';
import { saveAffiliateSettings, saveProviderConfig } from './actions';
import { cookies } from 'next/headers';
import { getServerEnv } from '@trendsinusa/shared';

export default async function AdminAffiliateSettingsPage() {
  const db = await getAdminDbStatus();
  if (db.status !== 'ready') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Affiliate Settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure Amazon Associate ID + global enable/disable.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">Database status</div>
          {db.status === 'needs_migration' ? (
            <div className="mt-2 space-y-2 text-sm text-amber-900">
              <div>Migrations are not applied yet. This page requires the database schema.</div>
              <div className="text-xs text-amber-800">
                Run: <span className="rounded bg-amber-100 px-2 py-1 font-mono">pnpm prisma:migrate:deploy</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-sm text-amber-900">
              <div>Database is unreachable.</div>
              <div className="rounded bg-amber-100 p-2 font-mono text-xs text-amber-900 break-all">
                {db.message}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const env = getServerEnv();
  const store = await cookies();
  const siteKey = store.get('tui_admin_site')?.value ?? env.SITE_KEY;

  const cfg = await getAffiliateConfigUS(siteKey);
  const enabled = cfg?.enabled ?? false;
  const associateTag = cfg?.associateTag ?? '';

  const providerConfigs = await prisma.affiliateProviderConfig.findMany({
    where: { siteKey },
    orderBy: [{ priority: 'asc' }, { provider: 'asc' }],
  });

  const sampleUrl = 'https://www.amazon.com/dp/B0C1234567';
  const preview = buildAmazonAffiliateUrl({
    url: sampleUrl,
    enabled,
    associateTag,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Affiliate Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Non-negotiable: validate affiliate IDs before deals go live. No hard-coded tags anywhere.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Site: <span className="font-mono">{siteKey}</span>
        </p>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Amazon Associate configuration (US)
        </div>

        <div className="p-4">
          <form action={saveAffiliateSettings} className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={enabled}
                className="h-4 w-4"
              />
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
                defaultValue={associateTag}
                placeholder="yourtag-20"
                className="mt-1 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Stored in <code className="rounded bg-slate-100 px-1">AffiliateConfig</code>. All outbound
                product links are wrapped dynamically—no hard-coded tags.
              </p>
            </div>

            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
            const cfg = providerConfigs.find((x) => x.provider === p) ?? null;
            return (
              <div key={p} className="rounded-md border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">{p}</div>
                <form action={saveProviderConfig} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input type="hidden" name="provider" value={p} />

                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      name="providerEnabled"
                      defaultChecked={cfg?.enabled ?? false}
                      className="h-4 w-4"
                    />
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
                      (No providers are used unless enabled and a product has a provider link.)
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Preview
        </div>
        <div className="p-4 space-y-2">
          <div className="text-xs text-slate-500">Sample URL</div>
          <div className="rounded bg-slate-50 p-2 font-mono text-xs text-slate-800">{sampleUrl}</div>

          <div className="text-xs text-slate-500">Generated affiliate URL</div>
          {preview.ok ? (
            <div className="rounded bg-slate-50 p-2 font-mono text-xs text-slate-800 break-all">
              {preview.url}
            </div>
          ) : (
            <div className="rounded bg-amber-50 p-2 text-xs text-amber-900">
              Affiliate links are blocked ({preview.reason}). Public outbound links should show a fallback
              message instead of sending users out.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

