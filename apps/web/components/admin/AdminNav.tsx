import Link from 'next/link';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/sites', label: 'Sites' },
  { href: '/admin/deals', label: 'Deals' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/automation/dashboard', label: 'Automation & AI' },
  { href: '/admin/seo-promotion', label: 'SEO & Promotion' },
  { href: '/admin/affiliate-settings', label: 'Affiliate Settings' },
  { href: '/admin/banners-hero', label: 'Banners & Hero' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/portfolio', label: 'Portfolio' },
  { href: '/admin/revenue', label: 'Revenue' },
  { href: '/admin/intelligence', label: 'Intelligence' },
  { href: '/admin/signals', label: 'Signals' },
  { href: '/admin/monetization', label: 'Monetization' },
  { href: '/admin/governance', label: 'Governance' },
  { href: '/admin/network', label: 'Network' },
  { href: '/admin/dependencies', label: 'Dependencies' },
  { href: '/admin/partners', label: 'Partners' },
  { href: '/admin/hold', label: 'Hold' },
  { href: '/admin/exit', label: 'Exit' },
  { href: '/admin/system-logs', label: 'System & Logs' },
] as const;

export function AdminNav() {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

