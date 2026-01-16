import { getServerEnv } from '@trendsinusa/shared';
import { prisma } from '@/src/server/prisma';
import { generateProductCopy } from '@/src/server/admin/automation/productCopy';
import { revalidatePath } from 'next/cache';

async function runGenerate(formData: FormData) {
  'use server';
  const asin = String(formData.get('asin') ?? '').trim();
  if (!asin) return;
  await generateProductCopy({ asin, manualOverride: true });
  revalidatePath('/admin/automation/product-copy');
}

async function toggleProductAi(formData: FormData) {
  'use server';
  const asin = String(formData.get('asin') ?? '').trim();
  const aiDisabled = formData.get('aiDisabled') === 'on';
  if (!asin) return;
  await prisma.product.update({ where: { asin }, data: { aiDisabled } });
  await prisma.systemAlert.create({
    data: { type: 'SYSTEM', severity: 'INFO', noisy: true, message: `audit:product asin=${asin} action=ai_disabled value=${aiDisabled}` },
  });
  revalidatePath('/admin/automation/product-copy');
}

export default async function AutomationProductCopyPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const env = getServerEnv();
  const sp = await props.searchParams;
  const q = String(sp.q ?? '').trim();

  const products = await prisma.product.findMany({
    where: q ? { OR: [{ asin: { contains: q } }, { title: { contains: q, mode: 'insensitive' } }] } : {},
    orderBy: [{ aiLastGeneratedAt: 'asc' }, { updatedAt: 'desc' }],
    take: 50,
    select: {
      asin: true,
      title: true,
      aiDisabled: true,
      aiConfidenceScore: true,
      aiLastGeneratedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Configuration (from env)</div>
        <div className="mt-2 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Perplexity model</div>
            <div className="mt-1 font-mono text-xs">{env.AI_RESEARCH_MODEL}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Final model</div>
            <div className="mt-1 font-mono text-xs">{env.AI_FINAL_MODEL}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Min confidence</div>
            <div className="mt-1 font-mono text-xs">{env.AI_MIN_CONFIDENCE.toFixed(2)}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Auto-regenerate cadence (days)</div>
            <div className="mt-1 font-mono text-xs">{env.AI_AUTO_REGENERATE_DAYS}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Product copy</div>
        <form className="mt-3 flex flex-wrap gap-2" action="/admin/automation/product-copy" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search ASIN or title"
            className="w-80 rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
          <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">Search</button>
          <a className="px-3 py-2 text-sm text-slate-600 underline" href="/admin/automation/product-copy">
            Reset
          </a>
        </form>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">AI status</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Last run</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.asin} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{p.title}</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">{p.asin}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.aiDisabled ? 'disabled' : 'enabled'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.aiConfidenceScore == null ? '—' : p.aiConfidenceScore.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.aiLastGeneratedAt ? p.aiLastGeneratedAt.toISOString() : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <form action={runGenerate}>
                        <input type="hidden" name="asin" value={p.asin} />
                        <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">Generate</button>
                      </form>
                      <form action={toggleProductAi}>
                        <input type="hidden" name="asin" value={p.asin} />
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input type="checkbox" name="aiDisabled" defaultChecked={p.aiDisabled} />
                          Disable AI
                        </label>
                        <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">Save</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-slate-600">
                    No products.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

