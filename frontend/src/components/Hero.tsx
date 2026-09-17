import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export function Hero() {
  return (
    <div className="relative overflow-hidden">
      {/* mesh orbs */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="mesh-orb absolute -top-28 -left-24 h-[380px] w-[520px] rounded-full bg-orange-500/20"
          animate={{ x: [0, 18, 0], y: [0, 12, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="mesh-orb absolute -top-10 right-[-80px] h-[360px] w-[420px] rounded-full bg-blue-500/12"
          animate={{ x: [0, -14, 0], y: [0, 16, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="mesh-orb absolute bottom-[-80px] left-[30%] h-[420px] w-[600px] rounded-full bg-amber-500/10"
          animate={{ x: [0, 10, 0], y: [0, -10, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto max-w-5xl px-6 pt-10 pb-12 sm:pt-14 sm:pb-16 text-center"
      >
        <motion.div variants={item} className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 mb-6 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse-slow" />
          <span className="font-mono text-xs text-orange-400 tracking-widest uppercase">
            RAG-powered · 20 models · SA market data
          </span>
        </motion.div>

        <motion.h1 variants={item} className="text-4xl font-extrabold tracking-tight text-gray-100 sm:text-6xl leading-[0.95]">
          <span className="block">Know before you buy</span>
          <span className="block text-orange-500 mt-1">any used car in SA</span>
          <span className="block text-lg sm:text-xl font-medium text-gray-500 mt-3 tracking-normal normal-case">
            — ja, even that <span className="text-gray-300">now-now</span> Polo you've been eyeing
          </span>
        </motion.h1>

        <motion.p variants={item} className="mt-6 text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Ask about prices, faults, and reliability. Get grounded answers from a curated knowledge base — not guesswork, not hallucinated nonsense. Lekker.
        </motion.p>

        <motion.div variants={item} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="#demo"
            className="w-full sm:w-auto rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-bold text-white hover:bg-orange-400 transition-all shadow-lg shadow-orange-500/20"
          >
            Try a fake query — it’s fun, promise
          </a>
          <Link
            to="/signup"
            className="w-full sm:w-auto rounded-xl border border-gray-700 bg-gray-900/60 backdrop-blur px-8 py-3.5 text-sm font-semibold text-gray-200 hover:border-orange-500/40 hover:text-white transition-all"
          >
            Sign in to unlock everything
          </Link>
        </motion.div>

        {/* floating glass cards */}
        <motion.div variants={item} className="mt-10 hidden sm:grid grid-cols-3 gap-3 max-w-3xl mx-auto">
          <GlassCard title="Price verdict" value="GOOD DEAL" accent="text-green-400 border-green-500/20 bg-green-500/10" sub="Polo 1.0 TSI · 2019" />
          <GlassCard title="Known fault" value="HIGH · DSG" accent="text-red-400 border-red-500/20 bg-red-500/10" sub="Hesitation 60-90k km" delay={0.1} />
          <GlassCard title="Sources" value="3 cited" accent="text-blue-400 border-blue-500/20 bg-blue-500/10" sub="Cars.co.za + 2" delay={0.2} />
        </motion.div>
      </motion.div>
    </div>
  );
}

function GlassCard({ title, value, accent, sub, delay = 0 }: { title: string; value: string; accent: string; sub: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 + delay, duration: 0.5 }}
      whileHover={{ y: -6, scale: 1.02 }}
      className={`rounded-2xl border bg-gray-900/40 backdrop-blur p-4 text-left shadow-xl ${accent} animate-float`}
      style={{ animationDelay: `${delay}s` } as React.CSSProperties}
    >
      <p className="text-[11px] tracking-widest uppercase text-gray-500 font-mono">{title}</p>
      <p className="mt-1 text-sm font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </motion.div>
  );
}
