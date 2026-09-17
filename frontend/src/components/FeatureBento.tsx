import { motion } from "framer-motion";

export function FeatureBento() {
  return (
    <div className="mx-auto max-w-5xl px-6 mt-10 grid sm:grid-cols-3 gap-4">
      <BentoCard
        title="Price Intelligence"
        desc="Low / Mid / High with a verdict - GOOD DEAL, FAIR, ABOVE MARKET, OVERPRICED. No vibes, just ZAR."
        accent="from-green-500/10 via-blue-500/10 to-red-500/10"
        icon="₿"
        delay={0}
      />
      <BentoCard
        title="Market Position"
        desc="Where it sits vs its segment - percentile, peers, and a value label that actually helps you haggle."
        accent="from-blue-500/10 via-cyan-500/10 to-orange-500/10"
        icon="◉"
        delay={0.08}
      />
      <BentoCard
        title="3-Year TCO"
        desc="Purchase + fuel + insurance + maintenance = monthly reality check. Lekker on paper, lekker in your wallet?"
        accent="from-amber-500/10 via-orange-500/10 to-red-500/10"
        icon="⚡"
        delay={0.16}
      />
    </div>
  );
}

function BentoCard({ title, desc, accent, icon, delay }: { title: string; desc: string; accent: string; icon: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
      whileHover={{ y: -6, scale: 1.01 }}
      className="rounded-2xl border border-gray-800 bg-gray-900 p-5 overflow-hidden relative"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-60`} />
      <div className="relative">
        <div className="h-9 w-9 rounded-xl border border-gray-800 bg-gray-950 flex items-center justify-center text-sm">{icon}</div>
        <h3 className="mt-4 font-bold text-gray-100">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">{desc}</p>
      </div>
    </motion.div>
  );
}
