interface Props {
  answer: string;
}

export function AnswerPanel({ answer }: Props) {
  const [mainText, sourcesText] = splitSources(answer);

  return (
    <div className="animate-fade-in rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-orange-500">
        CarIQ Analysis
      </h2>
      <div className="prose prose-invert max-w-none">
        {mainText.split("\n").filter(Boolean).map((line, i) => (
          <p key={i} className="mb-3 text-gray-200 leading-relaxed last:mb-0">
            {line}
          </p>
        ))}
      </div>
      {sourcesText && (
        <div className="mt-5 border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500">{sourcesText}</p>
        </div>
      )}
    </div>
  );
}

function splitSources(answer: string): [string, string] {
  const idx = answer.indexOf("Sources:");
  if (idx === -1) return [answer, ""];
  return [answer.slice(0, idx).trim(), answer.slice(idx).trim()];
}
