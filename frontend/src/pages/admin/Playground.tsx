import { useEffect, useRef, useState } from "react";
import { adminTestQuery } from "../../api";
import type { ChatMessage, PlaygroundResult } from "../../types";
import { AnswerPanel } from "../../components/AnswerPanel";
import { KnownFaultsPanel } from "../../components/KnownFaultsPanel";
import { PriceIntelligencePanel } from "../../components/PriceIntelligencePanel";
import { SourceCitations } from "../../components/SourceCitations";
import { ErrorBox, btnPrimary, btnGhost, inputCls } from "../../components/admin/ui";

interface Turn {
  id: number;
  role: "user" | "assistant";
  content: string;
  result?: PlaygroundResult;
}

const SUGGESTIONS = [
  "What are the known faults on a Polo Vivo?",
  "Is R280k fair for a 2019 BMW 3 Series?",
  "Which bakkie holds value best, Hilux or Ranger?",
];

let turnId = 0;
const nextId = () => ++turnId;

export function AdminPlayground() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Guarded: jsdom (tests) has no scrollIntoView.
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [turns, loading]);

  async function send(raw: string, appendUser = true) {
    const q = raw.trim();
    if (!q || loading) return;
    const history: ChatMessage[] = turns.slice(-6).map((t) => ({ role: t.role, content: t.content }));
    if (appendUser) setTurns((prev) => [...prev, { id: nextId(), role: "user", content: q }]);
    setInput("");
    setLoading(true);
    setError(null);
    setLastQuestion(q);
    try {
      const result = await adminTestQuery(q, history);
      setTurns((prev) => [...prev, { id: nextId(), role: "assistant", content: result.answer, result }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test run failed");
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setTurns([]);
    setError(null);
    setLastQuestion("");
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Prompt Playground</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Test traffic bypasses the cache and is never logged. Follow-ups reuse the thread as history.
          </p>
        </div>
        {turns.length > 0 && (
          <button onClick={newChat} className={btnGhost()}>
            New test chat
          </button>
        )}
      </div>

      {turns.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-gray-800 px-6 py-10 text-center">
          <p className="text-sm text-gray-400">
            Ask anything you'd ask CarIQ — you'll see the answer plus exactly what the model retrieved.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-xs text-gray-300 transition-colors hover:border-orange-500/50 hover:text-orange-300"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4" role="log" aria-live="polite" aria-label="Test conversation">
        {turns.map((t) =>
          t.role === "user" ? (
            <div key={t.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm text-gray-100">
                {t.content}
              </div>
            </div>
          ) : (
            <AssistantTurn key={t.id} result={t.result as PlaygroundResult} />
          )
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-gray-800 bg-gray-900 px-4 py-3" aria-label="CarIQ is thinking">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-orange-500"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <ErrorBox text={error} onRetry={lastQuestion ? () => send(lastQuestion, false) : undefined} />}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 flex gap-2 border-t border-gray-900 bg-gray-950 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Test a question..."
          aria-label="Test question"
          className={inputCls()}
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !input.trim()} aria-label="Send" className={`${btnPrimary(loading)} shrink-0 px-4`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function AssistantTurn({ result }: { result: PlaygroundResult }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${result.refused ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"}`}>
          {result.refused ? "REFUSED (OUT OF KB)" : "ANSWERED"}
        </span>
        <span className="rounded-full bg-gray-800 px-2.5 py-1 text-gray-400">
          top score {result.top_score !== null ? result.top_score.toFixed(3) : "-"}
        </span>
        <span className="rounded-full bg-gray-800 px-2.5 py-1 text-gray-400">
          {(result.latency_ms / 1000).toFixed(1)}s
        </span>
        {result.rewritten_question && (
          <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-blue-300" title="The follow-up was rewritten using thread history before retrieval">
            rewritten: {result.rewritten_question}
          </span>
        )}
      </div>

      <AnswerPanel answer={result.answer} />
      {(result.price_intelligence || result.known_faults.length > 0 || result.sources.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {result.price_intelligence && <PriceIntelligencePanel data={result.price_intelligence} />}
          <KnownFaultsPanel faults={result.known_faults} />
          <SourceCitations sources={result.sources} />
        </div>
      )}

      <details className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-2.5">
        <summary className="cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-200">
          Retrieval — {result.chunks.length} chunk{result.chunks.length === 1 ? "" : "s"}
        </summary>
        <div className="mt-2 space-y-2 pb-1">
          {result.chunks.length === 0 && <p className="text-xs text-gray-600">No chunks retrieved.</p>}
          {result.chunks.map((c) => (
            <details key={c.id || `${c.make}-${c.model}-${c.score}`} className="rounded-lg bg-gray-900 px-3 py-2">
              <summary className="cursor-pointer font-mono text-xs text-gray-300">
                <span className="text-orange-400">{c.score.toFixed(3)}</span> {c.id}{" "}
                <span className="text-gray-600">[{c.chunk_type}]</span>
              </summary>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-400">{c.text}</p>
            </details>
          ))}
        </div>
      </details>
    </div>
  );
}
