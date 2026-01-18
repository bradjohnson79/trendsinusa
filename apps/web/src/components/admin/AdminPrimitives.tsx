import { useMemo } from 'react';

export function AdminSection(props: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{props.title}</h1>
          {props.description ? <p className="mt-1 text-sm text-slate-600">{props.description}</p> : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      {props.children}
    </div>
  );
}

export function AdminLoading(props: { label?: string }) {
  return <div className="text-sm text-slate-600">{props.label ?? 'Loading…'}</div>;
}

export function AdminError(props: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
      <div className="text-sm font-semibold text-rose-900">{props.title ?? 'Something went wrong'}</div>
      <div className="mt-2 text-sm text-rose-900">{props.message}</div>
      {props.onRetry ? (
        <button
          className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-900 hover:bg-rose-50"
          onClick={props.onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function AdminEmptyState(props: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      {props.description ? <div className="mt-2 text-sm text-slate-600">{props.description}</div> : null}
    </div>
  );
}

export function useHumanErrorMessage(err: unknown): string {
  return useMemo(() => {
    if (!err) return 'Unknown error';
    if (err instanceof Error) {
      // Avoid leaking raw server exceptions into the UI; keep it boring and actionable.
      if (/request failed/i.test(err.message)) return 'The API request failed. Check that the API is running on port 3005.';
      return err.message;
    }
    return 'Unknown error';
  }, [err]);
}

