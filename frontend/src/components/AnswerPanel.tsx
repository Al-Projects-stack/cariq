import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
      <div className="max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className="text-xl font-bold text-gray-100 mb-3 mt-6 first:mt-0">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-bold text-gray-100 mb-2 mt-5 first:mt-0">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-semibold text-gray-100 mb-2 mt-4 first:mt-0">{children}</h3>,
            p: ({ children }) => <p className="mb-3 text-gray-200 leading-relaxed last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-gray-200">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-gray-200">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
            hr: () => <hr className="border-gray-800 my-4" />,
            code: ({ children }) => <code className="rounded bg-gray-800 px-1.5 py-0.5 text-sm text-orange-400">{children}</code>,
          }}
        >
          {mainText}
        </ReactMarkdown>
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
