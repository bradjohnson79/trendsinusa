import { prisma } from '@/src/server/prisma';
import { evaluateDealIntelligence } from '@/src/server/admin/automation/dealIntelligence';
import { revalidatePath } from 'next/cache';
import { formatMoney, timeUntil } from '@/src/lib/format';

async function runEvaluate(formData: FormData) {
  'use server';
  const dealId = String(formData.get('dealId') ?? '').trim();
  if (!dealId) return;
  await evaluateDealIntelligence({ dealId, manualOverride: true });
  revalidatePath('/admin/automation/deals');
}

export default async function AutomationDealsPage() {
  const now = new Date();
  const deals = await prisma.deal.findMany({
    where: { expiresAt: { gt: now } },
    orderBy: [{ expiresAt: 'asc' }],
    take: 50,
    include: { product: { select: { asin: true, title: true, category: true, categoryOverride: true } } },
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Deal intelligence</div>
      <div className="p-4 text-sm text-slate-600">
        AI computes urgency tier + priority score + suggested feature/suppress flags. Admin visibility overrides still win.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-t border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Deal</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2">AI urgency</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">AI flags</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} className="border-b border-slate-200 align-top">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{d.product.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500 font-mono">
                    {d.id} · {d.product.asin}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{d.product.categoryOverride ?? d.product.category ?? '—'}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="tabular-nums font-medium">{formatMoney(d.currentPriceCents, d.currency)}</div>
                  <div className="text-xs text-slate-500 line-through">{d.oldPriceCents != null ? formatMoney(d.oldPriceCents, d.currency) : ''}</div>
                  <div className="text-xs text-slate-500">read-only</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <div>{d.expiresAt.toISOString()}</div>
                  <div className="text-slate-500">{timeUntil(d.expiresAt)}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{d.urgencyTier ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{d.dealPriorityScore == null ? '—' : d.dealPriorityScore.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  <div>aiFeatured: {d.aiFeatured ? 'true' : 'false'}</div>
                  <div>aiSuppressed: {d.aiSuppressed ? 'true' : 'false'}</div>
                  <div>manualSuppressed: {d.suppressed ? 'true' : 'false'}</div>
                </td>
                <td className="px-3 py-2">
                  <form action={runEvaluate}>
                    <input type="hidden" name="dealId" value={d.id} />
                    <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">Evaluate</button>
                  </form>
                </td>
              </tr>
            ))}
            {deals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-sm text-slate-600">
                  No deals.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

