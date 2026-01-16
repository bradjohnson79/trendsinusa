import { prisma } from '@/src/server/prisma';
import type { AIEntityType, Prisma } from '@prisma/client';

function pick(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

const ENTITY_TYPES: readonly AIEntityType[] = ['PRODUCT', 'DEAL', 'SEO', 'HERO'];
function asEntityType(v: string): AIEntityType | 'all' {
  if (!v || v === 'all') return 'all';
  return ENTITY_TYPES.includes(v as AIEntityType) ? (v as AIEntityType) : 'all';
}

export default async function AutomationLogsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const entityType = asEntityType(pick(sp.entityType));
  const model = pick(sp.model);
  const overrides = pick(sp.manualOverride);

  const where: Prisma.AIActionLogWhereInput = {};
  if (entityType !== 'all') where.entityType = entityType;
  if (model && model !== 'all') where.OR = [{ modelUsed: model }, { model: model }];
  if (overrides === 'yes') where.manualOverride = true;
  if (overrides === 'no') where.manualOverride = false;

  const rows = await prisma.aIActionLog.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      entityType: true,
      entityId: true,
      actionType: true,
      modelUsed: true,
      model: true,
      confidenceScore: true,
      inputHash: true,
      outputHash: true,
      manualOverride: true,
      error: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Filters</div>
        <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4" action="/admin/automation/logs" method="get">
          <label className="text-xs text-slate-600">
            Entity
            <select name="entityType" defaultValue={entityType || 'all'} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              <option value="all">all</option>
              <option value="PRODUCT">PRODUCT</option>
              <option value="DEAL">DEAL</option>
              <option value="SEO">SEO</option>
              <option value="HERO">HERO</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Model
            <input name="model" defaultValue={model} placeholder="e.g. gpt-4.1" className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" />
          </label>
          <label className="text-xs text-slate-600">
            Overrides
            <select name="manualOverride" defaultValue={overrides || 'all'} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              <option value="all">all</option>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">Apply</button>
            <a className="text-sm text-slate-600 underline" href="/admin/automation/logs">
              Reset
            </a>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Conf</th>
              <th className="px-3 py-2">Override</th>
              <th className="px-3 py-2">Hashes</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-2 font-mono text-xs">
                  <div>{r.startedAt.toISOString()}</div>
                  <div className="text-slate-500">{r.finishedAt ? `→ ${r.finishedAt.toISOString()}` : ''}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <div>{r.entityType ?? '—'}</div>
                  <div className="text-slate-500 break-all">{r.entityId ?? '—'}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.actionType ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{r.modelUsed ?? r.model ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.status}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.confidenceScore == null ? '—' : r.confidenceScore.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.manualOverride ? 'yes' : 'no'}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-700">
                  <div>in: {r.inputHash ?? '—'}</div>
                  <div>out: {r.outputHash ?? '—'}</div>
                </td>
                <td className="px-3 py-2 text-xs text-rose-800">{r.error ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-slate-600" colSpan={9}>
                  No logs.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

