import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const EXAMPLE_Q = "Is R185k fair for a 2019 Polo 1.0 TSI in Cape Town?";
const EXAMPLE_A = `Short answer: Yep - that's a GOOD DEAL if it's a clean service history.

Price: The 2019 Polo 1.0 TSI sits around R175k - R205k (mid R189k) in the mother city. R185k is just under mid, so you're not being taken for a ride. Check for extras though - if it's a base Trendline with dings, push for R175k.

Watch out: The 7-speed DSG can get hesitant around 60-90k km - feels like a kangaroo in traffic. Listen for shudders on pull-away and ask when the gearbox oil was last done. Budget R6k - R12k if it needs love.

Why this is lekker: Polo holds value like a Hilux holds grudges. Resale is strong and parts are everywhere - from Bellville to Boksburg.

Sources: Cars.co.za, AutoTrader SA, MyBroadband`;

export function LiveDemo() {
  const { user } = useAuth();
  const [typed, setTyped] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    t = setTimeout(() => setStarted(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const full = EXAMPLE_A;
    const id = setInterval(() => {
      i += 3;
      if (i >= full.length) {
        setTyped(full);
        clearInterval(id);
      } else {
        setTyped(full.slice(0, i));
      }
    }, 14);
    return () => clearInterval(id);
  }, [started]);

  return (
    <div id="demo" className="mx-auto max-w-5xl px-6">
      <div className="mt-10 rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-950/50">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
            <span className="ml-3 font-mono text-xs text-gray-500">Example - how it works</span>
          </div>
          <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase text-gray-600">typing…</span>
        </div>

        <div className="grid lg:grid-cols-5 gap-0">
          <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-gray-800 p-5 bg-gray-900/30">
            <p className="font-mono text-xs tracking-widest uppercase text-gray-500">Example question</p>
            <div className="mt-3 rounded-xl border border-gray-800 bg-gray-950 p-4">
              <p className="text-sm text-gray-200 leading-relaxed">"{EXAMPLE_Q}"</p>
              <p className="mt-3 text-xs text-gray-500">Demo question to show the kind of answer you will get. Try your own below - no account needed.</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse-slow" />
              <span className="font-mono text-xs text-gray-500">Pinecone - 5 chunks - 384 dims</span>
            </div>
            {!user && (
              <Link to="/signup" className="mt-5 inline-flex w-full justify-center rounded-xl border border-gray-700 bg-gray-800 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-orange-500/40 hover:text-white transition-colors">
                Sign in to save searches and cars
              </Link>
            )}
            {user && <p className="mt-5 text-xs text-green-400 font-medium">You are in - try a real question below.</p>}
          </div>

          <div className="lg:col-span-3 p-5">
            <p className="font-mono text-xs tracking-widest uppercase text-gray-500">Example answer</p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 rounded-xl border border-gray-800 bg-gray-950 p-5 min-h-[260px]"
            >
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-200">{typed}<span className="inline-block h-4 w-1.5 bg-orange-500 ml-0.5 animate-pulse align-middle" /></pre>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400">GOOD DEAL</span>
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-400">HIGH - DSG hesitation</span>
                <span className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-400">Sources: 3</span>
              </div>
            </motion.div>
            <p className="mt-3 text-xs text-gray-600">Example - real answers are grounded in 20-model SA knowledge base and cite sources.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
