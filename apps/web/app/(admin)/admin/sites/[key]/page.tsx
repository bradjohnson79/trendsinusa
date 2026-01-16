import Link from 'next/link';
import { notFound } from 'next/navigation';

import { readSitesConfig } from '@trendsinusa/shared';
import { setAdminSite } from '../actions';
import { updateSiteOverrides } from './actions';

export default async function AdminSiteSettingsPage(props: { params: Promise<{ key: string }> }) {
  const { key } = await props.params;
  const decoded = decodeURIComponent(key);

  const { config, path } = await readSitesConfig();
  const site = config.sites.find((s) => s.key === decoded) ?? null;
  if (!site) return notFound();

  const layout = site.overrides.homepageLayout.join(', ');
  const emphasis = site.overrides.categoryEmphasis.join(', ');
  const eligibleTypes = site.overrides.featuredPlacementRules.eligibleTypes.join(', ');
  const order = site.overrides.featuredPlacementRules.order.join(', ');

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Site settings</h1>
          <div className="mt-1 text-sm text-slate-600">
            <span className="font-mono text-xs">{site.key}</span> — {site.name} ({site.domain})
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Config file: <span className="font-mono">{path}</span>
          </div>
        </div>
        <Link href="/admin/sites" className="text-sm text-slate-600 hover:text-slate-900">
          Back
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Admin context</div>
        <div className="p-4 flex flex-wrap items-center gap-3">
          <form action={setAdminSite}>
            <input type="hidden" name="key" value={site.key} />
            <button
              type="submit"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Select this site in admin
            </button>
          </form>
          <div className="text-xs text-slate-500">
            Public site selection still uses <code className="rounded bg-slate-100 px-1">SITE_KEY</code> env; this only
            changes admin viewing/editing context.
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Presentation overrides (safe, config-driven)
        </div>
        <div className="p-4">
          <form action={updateSiteOverrides} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input type="hidden" name="key" value={site.key} />

            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="heroTone">
                Hero tone
              </label>
              <select
                id="heroTone"
                name="heroTone"
                defaultValue={site.overrides.heroTone}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="conservative">conservative</option>
                <option value="neutral">neutral</option>
                <option value="energetic">energetic</option>
              </select>
              <div className="mt-1 text-xs text-slate-500">Controls the hero subcopy tone (AI prompts can use this later).</div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="premiumLimit">
                Premium limit
              </label>
              <input
                id="premiumLimit"
                name="premiumLimit"
                type="number"
                defaultValue={site.overrides.featuredPlacementRules.premiumLimit}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="homepageLayout">
                Homepage layout (comma-separated section keys)
              </label>
              <input
                id="homepageLayout"
                name="homepageLayout"
                type="text"
                defaultValue={layout}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <div className="mt-1 text-xs text-slate-500">
                Allowed: <code className="rounded bg-slate-100 px-1">premium</code>,{' '}
                <code className="rounded bg-slate-100 px-1">sponsored</code>,{' '}
                <code className="rounded bg-slate-100 px-1">live</code>,{' '}
                <code className="rounded bg-slate-100 px-1">trending</code>,{' '}
                <code className="rounded bg-slate-100 px-1">banners</code>.
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="categoryEmphasis">
                Category emphasis (comma-separated categories)
              </label>
              <input
                id="categoryEmphasis"
                name="categoryEmphasis"
                type="text"
                defaultValue={emphasis}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <div className="mt-1 text-xs text-slate-500">Used to bias ordering of “Trending” deals on the homepage.</div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="eligibleTypes">
                Featured placement eligible types (comma-separated)
              </label>
              <input
                id="eligibleTypes"
                name="eligibleTypes"
                type="text"
                defaultValue={eligibleTypes}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="order">
                Featured placement order (comma-separated)
              </label>
              <input
                id="order"
                name="order"
                type="text"
                defaultValue={order}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Save overrides
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

