import { motion } from "framer-motion";

const SOURCES = ["MyBroadband", "Cars.co.za", "AutoTrader SA", "WeBuyCars", "SA Owner Communities", "MyBroadband", "Cars.co.za", "AutoTrader SA"];
const FACTS = [
  { value: "20", label: "SA models" },
  { value: "101", label: "Pinecone vectors" },
  { value: "384", label: "embedding dims" },
  { value: "5", label: "chunks / query" },
];

export function SocialProof() {
  return (
    <div className="border-y border-gray-900 bg-gray-900/30 backdrop-blur">
      <div className="relative overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap py-3">
          {[...SOURCES, ...SOURCES].map((s, i) => (
            <span key={i} className="mx-6 font-mono text-xs tracking-widest uppercase text-gray-600">
              {s} <span className="mx-6 text-gray-800">·</span>
            </span>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {FACTS.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 text-center"
          >
            <p className="text-xl font-black text-gray-100">{f.value}</p>
            <p className="text-xs text-gray-500 font-mono tracking-wide">{f.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
