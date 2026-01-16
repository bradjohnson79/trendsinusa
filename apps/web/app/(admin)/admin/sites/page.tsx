import { readSitesConfig } from '@trendsinusa/shared';
import { prisma } from '@/src/server/prisma';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { toggleSiteEnabled, createSite, setAdminSite } from './actions';

function siteTag(key: string) {
  return `site:${key}`;
}

export default async function AdminSitesPage() {
  const { config, path } = await readSitesConfig();
  const cookieStore = await cookies();
  const selected = cookieStore.get('tui_admin_site')?.value ?? null;
  const now = new Date();

  const liveStatuses = ['ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H'] as const;

  const health = await Promise.all(
    config.sites.map(async (s) => {
      const tag = siteTag(s.key);
      const [liveDeals, products] = await Promise.all([
        prisma.deal.count({
          where: {
            suppressed: false,
            status: { in: [...liveStatuses] },
            expiresAt: { gt: now },
            product: { tags: { has: tag } },
          },
        }),
        prisma.product.count({ where: { tags: { has: tag } } }),
      ]);
      return { key: s.key, liveDeals, products };
    }),
  );

  const healthByKey = new Map(health.map((h) => [h.key, h] as const));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sites</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configuration-driven vertical replication. Core ingestion remains shared; routing uses <code className="rounded bg-slate-100 px-1">Product.tags</code>.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Config file: <span className="font-mono">{path}</span>
        </p>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Active site registry</div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">Key</th>
                <th className="py-2 pr-4">Domain</th>
                <th className="py-2 pr-4">Enabled</th>
                <th className="py-2 pr-4">Default categories</th>
                <th className="py-2 pr-4">Products</th>
                <th className="py-2 pr-4">Live deals</th>
                <th className="py-2 pr-4">Context</th>
                <th className="py-2 pr-4">Edit</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {config.sites.map((s) => {
                const h = healthByKey.get(s.key);
                return (
                  <tr key={s.key} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{s.key}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{s.domain}</td>
                    <td className="py-2 pr-4">{s.enabled ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4">
                      {s.defaultCategories.length ? (
                        <span className="font-mono text-xs">{s.defaultCategories.join(', ')}</span>
                      ) : (
                        <span className="text-xs text-slate-500">All</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{h?.products ?? 0}</td>
                    <td className="py-2 pr-4 tabular-nums">{h?.liveDeals ?? 0}</td>
                    <td className="py-2 pr-4">
                      {selected === s.key ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Selected</span>
                      ) : (
                        <form action={setAdminSite}>
                          <input type="hidden" name="key" value={s.key} />
                          <button
                            type="submit"
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                          >
                            Select
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/sites/${encodeURIComponent(s.key)}`}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                      >
                        Settings
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <form action={toggleSiteEnabled}>
                        <input type="hidden" name="key" value={s.key} />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                        >
                          {s.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Create site instance</div>
        <div className="p-4">
          <form action={createSite} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="key">
                Site key
              </label>
              <input
                id="key"
                name="key"
                type="text"
                placeholder="e.g. trendsinuk"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="domain">
                Domain
              </label>
              <input
                id="domain"
                name="domain"
                type="text"
                placeholder="e.g. trendsinuk.com"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="name">
                Site name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="e.g. Trends in UK"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="defaultCategories">
                Default categories (comma-separated; blank = all)
              </label>
              <input
                id="defaultCategories"
                name="defaultCategories"
                type="text"
                placeholder="e.g. electronics, home, beauty"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-800 md:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4" />
              Enable site immediately
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Create site
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Note: this writes to the repo config file. In a future hardening pass, we can persist sites in DB if you
                want fully serverless-safe admin edits.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

