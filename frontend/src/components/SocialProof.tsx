import { motion } from "framer-motion";

const STEPS = [
  {
    value: "20",
    label: "SA models",
    sub: "curated in Pretoria, not scraped",
    icon: "🚗",
  },
  {
    value: "101",
    label: "Pinecone vectors",
    sub: "each fault and price, embedded",
    icon: "◈",
  },
  {
    value: "384",
    label: "embedding dims",
    sub: "how we hear is it a good deal?",
    icon: "≋",
  },
  {
    value: "5",
    label: "chunks / query",
    sub: "top matches per question",
    icon: "◫",
  },
];

const SOURCES = ["MyBroadband", "Cars.co.za", "AutoTrader SA", "WeBuyCars"];

export function SocialProof() {
  return (
    <div className="mx-auto max-w-5xl px-6 mt-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
        className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-5 sm:p-6 overflow-hidden relative"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-500/10 blur-2xl" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="font-mono text-xs tracking-widest uppercase text-orange-400">How the knowledge flows</p>
          <span className="font-mono text-[11px] tracking-widest uppercase text-gray-600">20 models live, growing</span>
        </div>

        {/* pipeline */}
        <div className="relative mt-6">
          {/* connectors - desktop */}
          <div className="hidden sm:block pointer-events-none absolute top-[34px] left-[8%] right-[8%] h-px bg-gradient-to-r from-orange-500/0 via-orange-500/30 to-orange-500/0" />
          <motion.div
            className="hidden sm:block pointer-events-none absolute top-[34px] left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent"
            initial={{ scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: "easeInOut", delay: 0.2 }}
            style={{ transformOrigin: "left" }}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="group relative rounded-2xl border border-gray-800 bg-gray-950/70 p-4 backdrop-blur hover:border-orange-500/20 transition-colors"
              >
                <div className="h-9 w-9 rounded-xl border border-gray-800 bg-gray-900 flex items-center justify-center text-sm group-hover:border-orange-500/20 transition-colors">
                  <span aria-hidden>{s.icon}</span>
                </div>
                <p className="mt-3 text-2xl font-black tracking-tight text-gray-100">{s.value}</p>
                <p className="font-mono text-[11px] tracking-widest uppercase text-gray-500">{s.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 group-hover:text-gray-400 transition-colors">{s.sub}</p>
                <span className="absolute top-3 right-3 font-mono text-[11px] text-gray-700">{String(i + 1).padStart(2, "0")}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* sources */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-4">
          <span className="font-mono text-[11px] tracking-widest uppercase text-gray-600 mr-1">Trusted sources</span>
          {SOURCES.map((src) => (
            <span key={src} className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1 text-xs text-gray-500">
              {src}
            </span>
          ))}
          <span className="ml-auto hidden sm:inline font-mono text-[11px] text-gray-700">SA owner communities</span>
        </div>
      </motion.div>
    </div>
  );
}
