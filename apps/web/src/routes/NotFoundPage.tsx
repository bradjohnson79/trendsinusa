import { Link, useLocation } from 'react-router-dom';

export function NotFoundPage() {
  const loc = useLocation();
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">Not found</h1>
      <p className="text-slate-700">
        No route matches <span className="font-mono">{loc.pathname}</span>.
      </p>
      <Link className="text-sm text-sky-700 underline" to="/">
        Go home
      </Link>
    </div>
  );
}

