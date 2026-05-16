/**
 * Visual explainer of the CarIQ RAG pipeline.
 * ui-pro-max: dark OLED, Fira Code tech labels, SVG icons (no emoji),
 * step connectors, glow accents.
 */

type Step = {
  icon: React.ReactNode;
  label: string;
  description: string;
  tech: string;
  highlight: boolean;
};

export function HowItWorks() {
  return (
    <section className="mt-20 mb-12">
      <div className="text-center mb-12">
        <span className="inline-block rounded-full bg-orange-500/10 border border-orange-500/30 px-4 py-1.5 text-xs font-mono text-orange-400 uppercase tracking-widest mb-4">
          Under the Hood
        </span>
        <h2 className="text-3xl font-bold text-gray-100">How CarIQ Works</h2>
        <p className="mt-3 text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
          Every answer is grounded in a curated South African used car knowledge base —
          never hallucinated, always sourced.
        </p>
      </div>

      {/* Desktop: horizontal flow */}
      <div className="hidden lg:flex items-start gap-0 max-w-5xl mx-auto">
        {STEPS.map((step, i) => (
          <div key={i} className="flex-1 flex flex-col items-center relative">
            {i < STEPS.length - 1 && (
              <div className="absolute top-8 left-1/2 w-full flex items-center z-0 pointer-events-none">
                <div className="flex-1 h-px bg-gradient-to-r from-orange-500/25 to-orange-500/8" />
                <ChevronRight className="w-3 h-3 text-orange-500/30 -ml-1 shrink-0" />
              </div>
            )}
            <StepCard step={step} index={i} />
          </div>
        ))}
      </div>

      {/* Mobile: vertical flow */}
      <div className="lg:hidden max-w-lg mx-auto space-y-3">
        {STEPS.map((step, i) => (
          <div key={i} className="relative pl-14">
            {i < STEPS.length - 1 && (
              <div className="absolute left-[26px] top-14 w-px h-[calc(100%+12px)] bg-gradient-to-b from-orange-500/30 to-transparent" />
            )}
            <div className={`
              absolute left-0 top-2 flex h-12 w-12 items-center justify-center rounded-xl border
              ${step.highlight ? "border-orange-500/50 bg-orange-500/10" : "border-gray-800 bg-gray-900"}
            `}>
              {step.icon}
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-orange-500">Step {i + 1}</span>
                <span className="text-sm font-semibold text-gray-100">{step.label}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>
              <code className="mt-2 block font-mono text-xs text-gray-600">{step.tech}</code>
            </div>
          </div>
        ))}
      </div>

      {/* Architecture bar */}
      <div className="mt-12 max-w-5xl mx-auto rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">
          Full Stack Architecture
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {ARCH_FLOW.map((item, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className={`rounded-lg px-3 py-1.5 border font-mono ${item.colour}`}>
                {item.label}
              </span>
              {i < ARCH_FLOW.length - 1 && (
                <ChevronRight className="h-3 w-3 text-gray-700 shrink-0" />
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-6 max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
        {FACTS.map((fact, i) => (
          <div key={i} className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-orange-500 font-mono">{fact.value}</p>
            <p className="mt-1 text-xs text-gray-500">{fact.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <div
      className="relative z-10 mx-2 flex flex-col items-center animate-fade-in"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className={`
        flex h-16 w-16 items-center justify-center rounded-2xl border mb-3
        transition-all duration-200
        ${step.highlight
          ? "border-orange-500/50 bg-orange-500/10 shadow-[0_0_18px_rgba(249,115,22,0.18)]"
          : "border-gray-800 bg-gray-900"}
      `}>
        {step.icon}
      </div>
      <span className="font-mono text-xs text-orange-500 mb-1">Step {index + 1}</span>
      <p className="text-sm font-semibold text-gray-100 text-center mb-2 leading-snug">
        {step.label}
      </p>
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 w-full text-center">
        <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>
        <code className="mt-2 block font-mono text-xs text-gray-600 truncate">{step.tech}</code>
      </div>
    </div>
  );
}

// SVG icon components — ui-pro-max: Heroicons, no emoji
function IconChat() {
  return (
    <svg className="h-7 w-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}
function IconVector() {
  return (
    <svg className="h-7 w-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg className="h-7 w-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
function IconDatabase() {
  return (
    <svg className="h-7 w-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg className="h-7 w-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg className="h-7 w-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function ChevronRight({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

const STEPS: Step[] = [
  {
    icon: <IconChat />,
    label: "User Query",
    description: "You type a plain-English question about any SA used car — price, faults, or reliability.",
    tech: "React · Pydantic validation",
    highlight: false,
  },
  {
    icon: <IconVector />,
    label: "Embed Query",
    description: "The question is converted into a 384-dimension semantic vector using MiniLM-L6-v2.",
    tech: "sentence-transformers",
    highlight: false,
  },
  {
    icon: <IconSearch />,
    label: "Vector Search",
    description: "Pinecone finds the 5 most relevant knowledge base chunks using cosine similarity.",
    tech: "Pinecone · cosine similarity",
    highlight: true,
  },
  {
    icon: <IconDatabase />,
    label: "Build Context",
    description: "Retrieved chunks — faults, prices, inspection tips — are assembled into structured context.",
    tech: "RAG pipeline · FastAPI",
    highlight: false,
  },
  {
    icon: <IconSparkle />,
    label: "Claude Generates",
    description: "Claude Sonnet answers using only the retrieved context — grounded, never hallucinated.",
    tech: "claude-sonnet-4-6",
    highlight: false,
  },
  {
    icon: <IconChart />,
    label: "Structured Response",
    description: "The answer is parsed into Price Intelligence, Known Faults, and Source Citations panels.",
    tech: "TypeScript · React",
    highlight: false,
  },
];

const ARCH_FLOW = [
  { label: "React UI",       colour: "border-blue-800   bg-blue-950/40   text-blue-400"   },
  { label: "FastAPI",        colour: "border-green-800  bg-green-950/40  text-green-400"  },
  { label: "RAG Service",    colour: "border-orange-800 bg-orange-950/40 text-orange-400" },
  { label: "MiniLM Embed",   colour: "border-purple-800 bg-purple-950/40 text-purple-400" },
  { label: "Pinecone",       colour: "border-cyan-800   bg-cyan-950/40   text-cyan-400"   },
  { label: "Claude Sonnet",  colour: "border-orange-800 bg-orange-950/40 text-orange-400" },
  { label: "SQLite / PG",    colour: "border-gray-700   bg-gray-900      text-gray-400"   },
];

const FACTS = [
  { value: "101",  label: "Pinecone vectors" },
  { value: "384",  label: "Embedding dims"  },
  { value: "5",    label: "Chunks per query" },
  { value: "∞",    label: "Models — growing" },
];
