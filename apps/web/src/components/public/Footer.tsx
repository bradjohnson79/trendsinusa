import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500">
        <div className="text-center md:text-left">
          <div className="font-semibold text-slate-700">TrendsInUSA.com</div>
          <div className="text-xs mt-1">Live deals · Fast expiry · Verified links</div>
          <div className="text-xs mt-2 text-slate-400">
            By using this site you agree to our policies. Some links may be affiliate links.
          </div>
          <div className="text-xs mt-3 text-slate-400">© {new Date().getFullYear()} TrendsInUSA.com</div>
        </div>

        <div className="flex gap-6">
          <Link href="/contact" className="hover:text-slate-700 transition">
            Contact
          </Link>
          <Link href="/terms" className="hover:text-slate-700 transition">
            Terms &amp; Conditions
          </Link>
          <Link href="/privacy" className="hover:text-slate-700 transition">
            Privacy Policy
          </Link>
          <Link href="/affiliate-disclosure" className="hover:text-slate-700 transition">
            Affiliate Disclosure
          </Link>
        </div>
      </div>
    </footer>
  );
}

