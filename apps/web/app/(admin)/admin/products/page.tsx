import type { IngestionSource } from '@prisma/client';
import { getAdminProducts } from '@/src/server/admin/products';
import { ProductsTable } from './ProductsTable';

const SOURCES: Array<IngestionSource | 'all'> = ['all', 'AMAZON_BEST_SELLER', 'AMAZON_LIGHTNING', 'AMAZON_DEAL', 'MANUAL'];
const TAGS = ['all', 'evergreen', 'seasonal', 'impulse', 'suppressed'] as const;
type TagFilter = (typeof TAGS)[number];
const HAS_ACTIVE = ['all', 'yes', 'no'] as const;
type HasActiveFilter = (typeof HAS_ACTIVE)[number];

function asTag(v: string): TagFilter {
  return TAGS.includes(v as TagFilter) ? (v as TagFilter) : 'all';
}
function asHasActive(v: string): HasActiveFilter {
  return HAS_ACTIVE.includes(v as HasActiveFilter) ? (v as HasActiveFilter) : 'all';
}
function asSource(v: string): IngestionSource | 'all' {
  return SOURCES.includes(v as IngestionSource | 'all') ? (v as IngestionSource | 'all') : 'all';
}

export default async function AdminProductsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const q = String(sp.q ?? '');
  const category = String(sp.category ?? '');
  const tag = asTag(String(sp.tag ?? 'all'));
  const source = asSource(String(sp.source ?? 'all'));
  const hasActiveDeal = asHasActive(String(sp.hasActiveDeal ?? 'all'));
  const site = String(sp.site ?? 'all');
  const cursor = sp.cursor ? String(sp.cursor) : null;

  const { products, nextCursor, sites } = await getAdminProducts({
    limit: 50,
    cursor,
    filters: { q, category, tag, source, hasActiveDeal, site },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Products</h1>
        <p className="mt-1 text-sm text-slate-600">
          Inventory intelligence. No deletions. No price edits. Use suppression + auditable overrides.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Filters</div>
        <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6" action="/admin/products" method="get">
          <label className="text-xs text-slate-600 md:col-span-2">
            Search
            <input
              name="q"
              defaultValue={q}
              placeholder="ASIN or title"
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>

          <label className="text-xs text-slate-600">
            Category
            <input
              name="category"
              defaultValue={category}
              placeholder="e.g. electronics"
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>

          <label className="text-xs text-slate-600">
            Tag
            <select name="tag" defaultValue={tag} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              {TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Source
            <select name="source" defaultValue={source} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Has active deal
            <select
              name="hasActiveDeal"
              defaultValue={hasActiveDeal}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            >
              {HAS_ACTIVE.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Site eligibility
            <select name="site" defaultValue={site} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              <option value="all">all</option>
              {sites
                .filter((s) => s.enabled)
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.key}
                  </option>
                ))}
            </select>
          </label>

          <div className="md:col-span-6 flex items-center gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">Apply</button>
            <a className="text-sm text-slate-600 underline" href="/admin/products">
              Reset
            </a>
            {cursor ? (
              <span className="ml-auto text-xs text-slate-500">
                Paging cursor active (filters apply on this page only). Use Reset to go back to first page.
              </span>
            ) : null}
          </div>
        </form>
      </div>

      <ProductsTable products={products} sites={sites} />

      {nextCursor ? (
        <div className="flex justify-center">
          <a
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            href={`/admin/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&tag=${encodeURIComponent(
              tag,
            )}&source=${encodeURIComponent(source)}&hasActiveDeal=${encodeURIComponent(hasActiveDeal)}&site=${encodeURIComponent(site)}&cursor=${encodeURIComponent(
              nextCursor,
            )}`}
          >
            Load more
          </a>
        </div>
      ) : null}
    </div>
  );
}

