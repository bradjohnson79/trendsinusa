import { Outlet } from 'react-router-dom';

import { AdminNav } from '@/components/admin/AdminNav';
import { siteConfig } from '@/sites/config';

export function AdminLayout() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-sm font-semibold text-slate-900">
            {siteConfig.branding.name} — Admin
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
            >
              View Frontpage
            </a>
            <div className="hidden text-xs text-slate-500 sm:block">Read-first · Override-second · Auditable</div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          <AdminNav />
        </aside>
        <main className="rounded-lg border border-slate-200 bg-white p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

