import type { ReactNode } from 'react';
import Link from 'next/link';

const tabs = [
  { href: '/admin/automation/dashboard', label: 'Dashboard' },
  { href: '/admin/automation/product-copy', label: 'Product copy' },
  { href: '/admin/automation/deals', label: 'Deals' },
  { href: '/admin/automation/seo', label: 'SEO' },
  { href: '/admin/automation/logs', label: 'Logs' },
] as const;

export default function AutomationLayout(props: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Automation &amp; AI</h1>
        <p className="mt-1 text-sm text-slate-600">
          Mission control for AI across products, deals, SEO, and promotion. Server-only execution. Every action is logged.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            {t.label}
          </Link>
        ))}
      </div>

      {props.children}
    </div>
  );
}

