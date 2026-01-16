export function EmptyState(props: {
  title: string;
  body: string;
  tone?: 'neutral' | 'scanning';
}) {
  const tone = props.tone ?? 'neutral';
  const badge =
    tone === 'scanning'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{props.title}</div>
          <div className="mt-1 text-sm text-slate-600">{props.body}</div>
        </div>
        <div className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${badge}`}>
          {tone === 'scanning' ? 'Scanning' : 'Stand by'}
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-slate-300" />
      </div>
    </div>
  );
}

