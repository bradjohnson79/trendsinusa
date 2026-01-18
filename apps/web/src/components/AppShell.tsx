import { Link, Outlet } from 'react-router-dom';

import { Logo } from '@/components/public/Logo';
import { siteConfig } from '@/sites/config';

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="group inline-flex items-center gap-3">
            <span className="flex flex-col leading-tight">
              <span className="inline-flex items-center gap-3">
                <Logo className="h-10 w-auto" />
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  {siteConfig.countryCode}
                </span>
              </span>

              <span className="text-xs text-slate-600">Live deals · Fast expiry · Verified links</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="/#deals" className="hover:text-blue-600 transition">
              Deals
            </a>
            <Link to="/posts" className="hover:text-blue-600 transition">
              Posts
            </Link>
            <a href="/#categories" className="hover:text-blue-600 transition">
              Categories
            </a>
            <a href="/#about" className="hover:text-blue-600 transition">
              About
            </a>
            <a href="/#how" className="hover:text-blue-600 transition">
              How It Works
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}

