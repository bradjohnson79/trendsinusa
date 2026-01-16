import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="group inline-flex items-center gap-3">
          <span className="flex flex-col leading-tight">
            <span
              className={[
                'inline-flex items-center gap-2 text-xl font-extrabold uppercase tracking-tight',
                // 1px black outline (best-effort cross-browser)
                '[-webkit-text-stroke:1px_#0f172a]',
                '[text-shadow:1px_0_0_#0f172a,-1px_0_0_#0f172a,0_1px_0_#0f172a,0_-1px_0_#0f172a]',
              ].join(' ')}
            >
              <span className="text-red-600">TRENDS</span>
              <span className="text-white">IN</span>
              <span className="text-blue-600">USA</span>
              <span className="text-white">.COM</span>

              {/* USA flag icon */}
              <span
                className="ml-1 inline-flex h-5 w-7 items-center justify-center overflow-hidden rounded-[6px] border border-slate-200 bg-white shadow-sm"
                aria-hidden="true"
              >
                <svg viewBox="0 0 70 50" className="h-full w-full">
                  {/* stripes */}
                  <rect width="70" height="50" fill="#fff" />
                  <g fill="#b91c1c">
                    <rect y="0" width="70" height="4" />
                    <rect y="8" width="70" height="4" />
                    <rect y="16" width="70" height="4" />
                    <rect y="24" width="70" height="4" />
                    <rect y="32" width="70" height="4" />
                    <rect y="40" width="70" height="4" />
                    <rect y="48" width="70" height="2" />
                  </g>
                  {/* canton */}
                  <rect x="0" y="0" width="28" height="20" fill="#1d4ed8" />
                  {/* simple "stars" as dots */}
                  <g fill="#fff" opacity="0.95">
                    <circle cx="4" cy="4" r="1" />
                    <circle cx="10" cy="4" r="1" />
                    <circle cx="16" cy="4" r="1" />
                    <circle cx="22" cy="4" r="1" />
                    <circle cx="7" cy="8" r="1" />
                    <circle cx="13" cy="8" r="1" />
                    <circle cx="19" cy="8" r="1" />
                    <circle cx="4" cy="12" r="1" />
                    <circle cx="10" cy="12" r="1" />
                    <circle cx="16" cy="12" r="1" />
                    <circle cx="22" cy="12" r="1" />
                    <circle cx="7" cy="16" r="1" />
                    <circle cx="13" cy="16" r="1" />
                    <circle cx="19" cy="16" r="1" />
                  </g>
                </svg>
              </span>
            </span>

            <span className="text-xs text-slate-600">Live deals · Fast expiry · Verified links</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/#deals" className="hover:text-blue-600 transition">Deals</Link>
          <Link href="/#categories" className="hover:text-blue-600 transition">Categories</Link>
          <Link href="/#about" className="hover:text-blue-600 transition">About</Link>
          <Link href="/#how" className="hover:text-blue-600 transition">How It Works</Link>
        </nav>
      </div>
    </header>
  );
}

