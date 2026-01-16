export const metadata = {
  title: 'Admin Login — trendsinusa.com',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Admin Login</h1>
      <p className="mt-2 text-sm text-slate-600">
        This area is protected. Sign in to continue.
      </p>

      <form action="/admin/login/action" method="post" className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-800" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-800" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-xs text-slate-500">
        Tip: set <code className="rounded bg-slate-100 px-1">ADMIN_BASIC_AUTH_*</code> and{' '}
        <code className="rounded bg-slate-100 px-1">ADMIN_SESSION_SECRET</code> in your root{' '}
        <code className="rounded bg-slate-100 px-1">.env</code>.
      </p>
    </main>
  );
}

