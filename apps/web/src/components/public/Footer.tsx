import { Link } from 'react-router-dom';

import { siteConfig } from '@/sites/config';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500">
        <div className="text-center md:text-left">
          <div className="font-semibold text-slate-700">{siteConfig.branding.name}</div>
          <div className="text-xs mt-1">Live deals · Fast expiry · Verified links</div>
          <div className="text-xs mt-2 text-slate-400">By using this site you agree to our policies. Some links may be affiliate links.</div>
          <div className="text-xs mt-3 text-slate-400">© {new Date().getFullYear()} {siteConfig.branding.name}</div>
        </div>

        <div className="flex gap-6">
          <Link to="/contact" className="hover:text-slate-700 transition">
            Contact
          </Link>
          <Link to="/terms" className="hover:text-slate-700 transition">
            Terms &amp; Conditions
          </Link>
          <Link to="/privacy" className="hover:text-slate-700 transition">
            Privacy Policy
          </Link>
          <Link to="/affiliate-disclosure" className="hover:text-slate-700 transition">
            Affiliate Disclosure
          </Link>
        </div>
      </div>
    </footer>
  );
}

