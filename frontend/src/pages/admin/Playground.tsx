import { useState } from "react";
import { adminTestQuery } from "../../api";
import type { PlaygroundResult } from "../../types";
import { AnswerPanel } from "../../components/AnswerPanel";
import { KnownFaultsPanel } from "../../components/KnownFaultsPanel";
import { PriceIntelligencePanel } from "../../components/PriceIntelligencePanel";
import { SourceCitations } from "../../components/SourceCitations";
import { Card, Loading, ErrorBox, inputCls, btnPrimary } from "../../components/admin/ui";

export function AdminPlayground() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await adminTestQuery(question.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test run failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-100">Prompt Playground</h1>
      <p className="text-sm text-gray-500">
        Dry-run a question through the live RAG pipeline and inspect exactly what the model saw.
        Test traffic bypasses the cache and is never logged, so it can't pollute failure stats.
        It does spend real tokens (logged as <span className="font-mono">playground</span>).
      </p>
      <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What are the known faults on a Polo Vivo?"
          className={inputCls()}
          aria-label="Test question"
        />
        <button type="submit" disabled={loading || !question.trim()} className={`${btnPrimary(loading)} shrink-0`}>
          {loading ? "Running..." : "Test"}
        </button>
      </form>

      {loading && <Loading label="Embedding, retrieving, generating..." />}
      {error && <ErrorBox text={error} onRetry={() => run()} />}

      {result && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${result.refused ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"}`}>
                {result.refused ? "REFUSED (out of KB)" : "ANSWERED"}
              </span>
              <span className="rounded-full bg-gray-800 px-2.5 py-1 text-gray-400">
                top score {result.top_score !== null ? result.top_score.toFixed(3) : "-"}
              </span>
              <span className="rounded-full bg-gray-800 px-2.5 py-1 text-gray-400">
                {(result.latency_ms / 1000).toFixed(1)}s
              </span>
              {result.rewritten_question && (
                <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-blue-300" title="No history in playground; shown when the rewriter fires">
                  rewritten: {result.rewritten_question}
                </span>
              )}
            </div>
          </Card>

          <AnswerPanel answer={result.answer} />
          <div className="grid gap-4 lg:grid-cols-3">
            {result.price_intelligence && <PriceIntelligencePanel data={result.price_intelligence} />}
            <KnownFaultsPanel faults={result.known_faults} />
            <SourceCitations sources={result.sources} />
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-gray-200">
              Retrieved chunks ({result.chunks.length})
            </h2>
            <div className="mt-3 space-y-2">
              {result.chunks.length === 0 && <p className="text-sm text-gray-500">No chunks retrieved.</p>}
              {result.chunks.map((c) => (
                <details key={c.id || `${c.make}-${c.model}-${c.score}`} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
                  <summary className="cursor-pointer font-mono text-xs text-gray-300">
                    <span className="text-orange-400">{c.score.toFixed(3)}</span>
                    {" "}{c.id} <span className="text-gray-600">[{c.chunk_type}]</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-400">{c.text}</p>
                </details>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
