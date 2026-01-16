import { getServerEnv } from '@trendsinusa/shared';
import { getPartnerMetrics } from '@/src/server/admin/partners';
import { formatMoney } from '@/src/lib/format';

function centsToUsd(cents: number) {
  return formatMoney(cents, 'USD');
}

function bpsFee(amountCents: number, bps: number) {
  return Math.floor((amountCents * bps) / 10_000);
}

export default async function AdminMonetizationPage() {
  const env = getServerEnv();
  const report = await getPartnerMetrics({ days: 30 });

  const rows = report.partners.map((p) => {
    const platformFeeBps = p.monetization?.platformFeeBps ?? 2000;
    const platformFeeCents = bpsFee(p.estRevenueCents, platformFeeBps);
    const partnerNetCents = Math.max(0, p.estRevenueCents - platformFeeCents);
    return { ...p, platformFeeBps, platformFeeCents, partnerNetCents };
  });

  const platformTotal = rows.reduce((a, r) => a + r.platformFeeCents, 0);
  const partnerTotal = rows.reduce((a, r) => a + r.partnerNetCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ecosystem monetization (preview)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Value-aligned economics. No forced activation. No rent-seeking. All numbers are estimated + aggregated.
        </p>
        <div className="mt-2 text-xs text-slate-500">
          Billing mode: <span className="font-mono">{env.ECOSYSTEM_BILLING_MODE}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Partner net (30d, est.)</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{centsToUsd(partnerTotal)}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Platform revenue (30d, est.)</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{centsToUsd(platformTotal)}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Gross ecosystem revenue (30d, est.)</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{centsToUsd(report.totals.estRevenueCents)}</div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4 text-sm font-medium text-slate-900">Partners (30d)</div>
        <div className="p-4 overflow-x-auto">
          {rows.length === 0 ? (
            <div className="text-sm text-slate-600">No partners configured.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Key</th>
                  <th className="py-2 pr-4">Tier</th>
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Gross</th>
                  <th className="py-2 pr-4">Platform fee</th>
                  <th className="py-2 pr-4">Partner net</th>
                  <th className="py-2 pr-4">CTR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.key} className="border-t border-slate-200">
                    <td className="py-2 pr-4 font-mono text-xs">{p.key}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.tier}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.monetization?.model ?? 'revshare'}</td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(p.estRevenueCents)}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {centsToUsd(p.platformFeeCents)} <span className="text-xs text-slate-500">({p.platformFeeBps} bps)</span>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{centsToUsd(p.partnerNetCents)}</td>
                    <td className="py-2 pr-4 tabular-nums">{(p.ctr * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

