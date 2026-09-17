import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { QueryInput } from "../components/QueryInput";
import { AnswerPanel } from "../components/AnswerPanel";
import { KnownFaultsPanel } from "../components/KnownFaultsPanel";
import { PriceIntelligencePanel } from "../components/PriceIntelligencePanel";
import { SourceCitations } from "../components/SourceCitations";
import { ModelSearch } from "../components/ModelSearch";
import { HowItWorks } from "../components/HowItWorks";
import { Header } from "../components/Header";
import { SaveSearchButton } from "../components/SaveSearchButton";
import { Hero } from "../components/Hero";
import { SocialProof } from "../components/SocialProof";
import { LiveDemo } from "../components/LiveDemo";
import { FeatureBento } from "../components/FeatureBento";
import { useAuth } from "../contexts/AuthContext";
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
  const { user } = useAuth();
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<CarVariant[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [lastQuestion, setLastQuestion] = useState("");

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
    setLastQuestion(question);
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
        <motion.img
          src="/favicon.svg"
          alt="CarIQ"
          style={{ width: 56, height: 56 }}
          animate={{ scale: [1, 0.92, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />

      {/* Exciting hero */}
      <Hero />

      <SocialProof />

      {/* Playful fake demo — always visible as teaser */}
      <LiveDemo />

      {/* Feature bento */}
      <FeatureBento />

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Real RAG — soft-gate: only authed sees live query */}
        {user ? (
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-6">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 sm:p-6">
              <p className="font-mono text-xs tracking-widest uppercase text-orange-400">Your turn — ask anything</p>
              <p className="mt-1 text-sm text-gray-400">Real RAG, grounded answers, no hallucinations. Howzit!</p>
              <div className="mt-4">
                <QueryInput onSubmit={handleQuery} isLoading={isLoading} />
              </div>

              {error && (
                <div role="alert" className="mt-6 rounded-xl border border-red-800/60 bg-red-950/40 px-5 py-4 text-sm text-red-300 flex items-start gap-3">
                  <svg className="h-5 w-5 shrink-0 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </div>
              )}

              {isLoading && (
                <div className="mt-8 flex flex-col items-center gap-4">
                  <PipelineSpinner />
                  <div className="flex items-center gap-6 text-xs text-gray-600 font-mono">
                    <PipelineStep label="Embedding" />
                    <span className="text-gray-800">→</span>
                    <PipelineStep label="Pinecone" active />
                    <span className="text-gray-800">→</span>
                    <PipelineStep label="Answer" />
                  </div>
                </div>
              )}

              {response && !isLoading && (
                <div id="results" className="mt-8 space-y-4 animate-fade-in">
                  <AnswerPanel answer={response.answer} />
                  <div className="flex justify-end">
                    <SaveSearchButton query={lastQuestion} />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {response.price_intelligence && <PriceIntelligencePanel data={response.price_intelligence} />}
                    <KnownFaultsPanel faults={response.known_faults} />
                    <SourceCitations sources={response.sources} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-6 rounded-2xl border border-dashed border-gray-800 bg-gray-900/20 p-6 text-center">
            <p className="font-mono text-xs tracking-widest uppercase text-gray-500">Want the real thing?</p>
            <p className="mt-2 text-sm text-gray-400">Sign in and the whole RAG playground unlocks — ask anything, get price verdicts, faults, and sources for real. No more fake Polo stories.</p>
            <div className="mt-4 flex justify-center">
              <Link to="/signup" className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20">
                Sign up — it’s free, like free Test & Chips on race day
              </Link>
            </div>
          </motion.div>
        )}

        {/* Find Your Car */}
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-10 rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6 sm:p-8 overflow-hidden relative">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-500/10 blur-2xl" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-100">Not sure what to look for?</h2>
              <p className="mt-1 text-sm text-gray-500">Take a quick quiz — we’ll match you with the most lekker car for your budget and vibe.</p>
            </div>
            <Link to="/recommend" className="shrink-0 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-400 transition-all text-center shadow-lg shadow-orange-500/20">
              Find My Car
            </Link>
          </div>
        </motion.div>

        {/* Model browser */}
        <div id="models">
          <ModelSearch models={models} />
        </div>

        {/* How It Works — auth-gated */}
        {user && (
          <div id="how-it-works">
            <HowItWorks />
          </div>
        )}
        {!user && (
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-10 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
            <p className="text-sm text-gray-300 font-medium">Pssst… the secret sauce is behind the velvet rope</p>
            <p className="text-xs text-gray-500 mt-1">How CarIQ Works — the full pipeline with vectors, Pinecone, and Claude — shows once you’re in. Sneaky, hey?</p>
            <Link to="/signup" className="mt-4 inline-flex rounded-full border border-orange-500/40 bg-orange-500/10 px-5 py-2 text-xs font-semibold text-orange-400 hover:bg-orange-500/20">Unlock it</Link>
          </motion.div>
        )}
      </main>

      <footer className="border-t border-gray-900 px-6 py-8 text-center">
        <p className="text-xs text-gray-700 font-mono">CarIQ · Built for the SA used car market · 20 models at launch</p>
        <p className="mt-1 text-xs text-gray-800">Data: MyBroadband · Cars.co.za · AutoTrader SA · SA owner communities</p>
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
      <span>Searching knowledge base...</span>
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
