import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { readSitesConfig } from '@trendsinusa/shared';

export const metadata = {
  title: 'Admin — trendsinusa.com',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

function isLocalHost(host: string) {
  const h = host.toLowerCase();
  return h.startsWith('localhost') || h.startsWith('127.0.0.1') || h.startsWith('0.0.0.0');
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const selected = cookieStore.get('tui_admin_site')?.value ?? null;
  const [{ config }, h] = await Promise.all([readSitesConfig(), headers()]);
  const host = h.get('host') ?? '';

  const selectedSite = selected ? config.sites.find((s) => s.key === selected) ?? null : null;
  const frontpageHref = selectedSite && !isLocalHost(host) ? `https://${selectedSite.domain}/` : '/';
  const frontpageLabel = selectedSite ? `View Frontpage (${selectedSite.key})` : 'View Frontpage';

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-sm font-semibold text-slate-900">trendsinusa.com — Admin</div>
          <div className="flex items-center gap-3">
            <Link
              href={frontpageHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
            >
              {frontpageLabel}
            </Link>
            <div className="hidden text-xs text-slate-500 sm:block">Read-first · Override-second · Auditable</div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          <AdminNav />
        </aside>
        <main className="rounded-lg border border-slate-200 bg-white p-6">{children}</main>
      </div>
    </div>
  );
}

