interface Props {
  sources: string[];
}

export function SourceCitations({ sources }: Props) {
  if (sources.length === 0) return null;

  return (
    <div className="animate-fade-in rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-400">
        <SourceIcon />
        Sources
      </h3>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <span
            key={i}
            className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400 border border-gray-700"
          >
            {source}
          </span>
        ))}
      </div>
    </div>
  );
}

function SourceIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
