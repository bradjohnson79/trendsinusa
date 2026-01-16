import { regenerateHeroHeadline } from '@/src/server/admin/aiHero';
import { getActiveHero, getHeroHistory } from '@/src/server/admin/hero';

async function forceRegenerate() {
  'use server';
  await regenerateHeroHeadline();
}

export default async function AdminBannersHeroPage() {
  const [active, history] = await Promise.all([getActiveHero(), getHeroHistory(7)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Banners &amp; Hero</h1>
        <p className="mt-1 text-sm text-slate-600">
          Editor-in-chief controls. AI proposes; admin can veto/override explicitly.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Hero headline (active)
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-slate-900">
            {active?.headline ?? <span className="text-slate-600">No hero set for today yet.</span>}
          </div>
          <div className="text-xs text-slate-500">
            {active ? `Updated: ${active.forDate.toISOString()}` : '—'}
          </div>
          <form action={forceRegenerate}>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Force regenerate (AI)
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">
          Hero rotation history (last 7 days)
        </div>
        <div className="p-4">
          {history.length === 0 ? (
            <div className="text-sm text-slate-600">No hero history yet.</div>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">{h.forDate.toISOString()}</div>
                  <div className="mt-1 text-sm text-slate-900">{h.headline}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    source={h.source} {h.model ? `· model=${h.model}` : ''}{' '}
                    {h.promptVersion ? `· prompt=${h.promptVersion}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

