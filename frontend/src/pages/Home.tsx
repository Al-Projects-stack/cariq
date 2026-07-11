import { useState, useEffect } from "react";
import { QueryInput } from "../components/QueryInput";
import { AnswerPanel } from "../components/AnswerPanel";
import { KnownFaultsPanel } from "../components/KnownFaultsPanel";
import { PriceIntelligencePanel } from "../components/PriceIntelligencePanel";
import { SourceCitations } from "../components/SourceCitations";
import { ModelSearch } from "../components/ModelSearch";
import { HowItWorks } from "../components/HowItWorks";
import { queryCarIQ, listModels } from "../api";
import type { QueryResponse, CarVariant } from "../types";

const LOADING_MESSAGES = [
  "Give it a second, it's coming now now...",
  "Has anyone told you that you look beautiful today?",
  "Did you know pandas are becoming extinct? Just a random fact whilst you wait.",
  "Warming up the engines...",
  "Good things take time. Bad things too, but let's stay positive.",
  "We're fetching your cars, not stealing them. Promise.",
  "Fun fact: a group of flamingos is called a flamboyance. You're welcome.",
  "Almost there. Probably.",
  "Loading... please do not tap the glass.",
  "Phew... it's done. Just kidding. Almost though.",
  "Your patience is appreciated. Genuinely.",
  "Teaching the cars to line up nicely...",
];

export function Home() {
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<CarVariant[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    listModels()
      .then(setModels)
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, []);

  useEffect(() => {
    if (!modelsLoading) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
        setVisible(true);
      }, 400);
    }, 2800);
    return () => clearInterval(interval);
  }, [modelsLoading]);

  async function handleQuery(question: string) {
    setIsLoading(true);
    setError(null);
    setResponse(null);
    try {
      const result = await queryCarIQ(question, sessionId);
      setResponse(result);
      setSessionId(result.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (modelsLoading) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "1.5rem",
        textAlign: "center",
        padding: "0 1.5rem",
        background: "#030712",
      }}>
        <img
          src="/favicon.svg"
          alt="CarIQ"
          style={{ width: 56, height: 56, animation: "pulse 1.8s ease-in-out infinite" }}
        />
        <p style={{
          fontSize: 15,
          color: "#888",
          margin: 0,
          maxWidth: 320,
          lineHeight: 1.6,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}>
          {LOADING_MESSAGES[msgIndex]}
        </p>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.92); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Header — ui-pro-max: Fira Sans, minimal glow on logo */}
      <header className="sticky top-0 z-40 border-b border-gray-900/80 bg-gray-950/90 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <span className="text-2xl font-extrabold tracking-tight">
              <span className="text-orange-500" style={{ textShadow: "0 0 20px rgba(249,115,22,0.4)" }}>Car</span>
              <span className="text-white">IQ</span>
            </span>
            <p className="text-xs text-gray-700 mt-0.5 font-mono tracking-wide">
              SA used car intelligence
            </p>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
            <a href="#results" className="hover:text-gray-200 transition-colors duration-150 cursor-pointer">Results</a>
            <a href="#models" className="hover:text-gray-200 transition-colors duration-150 cursor-pointer">Models</a>
            <a href="#how-it-works" className="hover:text-gray-200 transition-colors duration-150 cursor-pointer">How It Works</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-14">

        {/* Hero — ui-pro-max: slide-up animation, Fira Code on tag */}
        <div className="mb-12 text-center animate-slide-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse-slow" />
            <span className="font-mono text-xs text-orange-400 tracking-widest uppercase">
              RAG-powered · 20 models · SA market data
            </span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-gray-100 sm:text-5xl leading-tight">
            Know before you buy
            <span className="block text-orange-500 mt-1">any used car in SA</span>
          </h1>
          <p className="mt-5 text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Ask about prices, faults, and reliability. Get grounded answers from a curated
            knowledge base — not guesswork.
          </p>
        </div>

        {/* Query input */}
        <QueryInput onSubmit={handleQuery} isLoading={isLoading} />

        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-800/60 bg-red-950/40 px-5 py-4 text-sm text-red-300 flex items-start gap-3"
          >
            <svg className="h-5 w-5 shrink-0 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="flex gap-3 items-center">
              <PipelineSpinner />
            </div>
            <div className="flex items-center gap-8 text-xs text-gray-600 font-mono">
              <PipelineStep label="Embedding" />
              <span className="text-gray-800">→</span>
              <PipelineStep label="Pinecone" active />
              <span className="text-gray-800">→</span>
              <PipelineStep label="Claude" />
            </div>
          </div>
        )}

        {/* Results */}
        {response && !isLoading && (
          <div id="results" className="mt-8 space-y-4 animate-fade-in">
            <AnswerPanel answer={response.answer} />

            <div className="grid gap-4 lg:grid-cols-3">
              {response.price_intelligence && (
                <PriceIntelligencePanel data={response.price_intelligence} />
              )}
              <KnownFaultsPanel faults={response.known_faults} />
              <SourceCitations sources={response.sources} />
            </div>
          </div>
        )}

        {/* Model browser */}
        <div id="models">
          <ModelSearch models={models} />
        </div>

        {/* How It Works visual explainer */}
        <div id="how-it-works">
          <HowItWorks />
        </div>
      </main>

      <footer className="border-t border-gray-900 px-6 py-8 text-center">
        <p className="text-xs text-gray-700 font-mono">
          CarIQ · Built for the SA used car market · 20 models at launch
        </p>
        <p className="mt-1 text-xs text-gray-800">
          Data: MyBroadband · Cars.co.za · AutoTrader SA · SA owner communities
        </p>
      </footer>
    </div>
  );
}

function PipelineSpinner() {
  return (
    <div className="flex items-center gap-3 text-gray-500 text-sm">
      <svg className="h-5 w-5 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Searching knowledge base…</span>
    </div>
  );
}

function PipelineStep({ label, active }: { label: string; active?: boolean }) {
  return (
    <span className={`font-mono text-xs transition-colors ${active ? "text-orange-400" : "text-gray-700"}`}>
      {active && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse-slow" />}
      {label}
    </span>
  );
}
