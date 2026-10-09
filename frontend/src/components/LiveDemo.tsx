import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface Example {
  q: string;
  a: string;
  chips: { text: string; tone: "green" | "red" | "gray" | "amber" }[];
}

const EXAMPLES: Example[] = [
  {
    q: "Is R185k fair for a 2019 Polo 1.0 TSI in Cape Town?",
    a: `Short answer: Yep - that's a GOOD DEAL if it's a clean service history.

Price: The 2019 Polo 1.0 TSI sits around R175k - R205k (mid R189k) in the mother city. R185k is just under mid, so you're not being taken for a ride. Check for extras though - if it's a base Trendline with dings, push for R175k.

Watch out: The 7-speed DSG can get hesitant around 60-90k km - feels like a kangaroo in traffic. Listen for shudders on pull-away and ask when the gearbox oil was last done. Budget R6k - R12k if it needs love.

Why this is lekker: Polo holds value like a Hilux holds grudges. Resale is strong and parts are everywhere - from Bellville to Boksburg.

Sources: Cars.co.za, AutoTrader SA, MyBroadband`,
    chips: [
      { text: "GOOD DEAL", tone: "green" },
      { text: "HIGH - DSG hesitation", tone: "red" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "What are the known faults on a 2016 Toyota Hilux 2.8 GD-6?",
    a: `Short answer: Very few - that's why they hold value like property in Sandton.

Known faults: The 2.8 GD-6 is one of Toyota's most solid bakkie engines. The main thing to check is injector wear past 200k km (rough idle, hard starting - budget R15k - R25k for a set). Some 2016-2017 models had DPF issues if they only did short Joburg school runs. Clutch on manuals can go around 180k km if it towed heavy.

What to check: Full Toyota service history is non-negotiable. Look for a clean load bin (no cracks = wasn't overloaded), test 4x4 engagement on gravel, and check for chassis rust if it lived at the coast.

Why this is lekker: A 2016 Hilux with 150k km still fetches R350k+. Buy right and you'll sell it for nearly what you paid.

Sources: Cars.co.za, SA Hilux owners community, WeBuyCars`,
    chips: [
      { text: "9.0 reliability", tone: "green" },
      { text: "MEDIUM - injector wear", tone: "amber" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Should I buy a 2015 BMW 320i with 120,000km for R170k?",
    a: `Short answer: Only with eyes wide open - and a warranty if you can swing it.

Price: R170k is FAIR for a clean 2015 320i (F30). The band sits around R150k - R190k. Under R160k usually means stories - accident history, skipped services, or the timing chain conversation nobody wants to have.

Watch out: The N20 timing chain and tensioner is THE issue at this mileage. Listen for a rattle on cold start - if you hear it, walk away or budget R25k - R40k. The electric water pump also likes to retire around 100-130k km (R12k - R18k). Get a pre-purchase inspection at a BMW specialist, not the seller's buddy.

Why it's tempting: Nothing drives like it at this price. Just budget R20k a year for maintenance on top of the purchase.

Sources: MyBroadband BMW forum, AutoTrader SA, SA BMW specialist workshops`,
    chips: [
      { text: "FAIR", tone: "amber" },
      { text: "HIGH - timing chain", tone: "red" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Ford Ranger 2.2 vs 3.2 - which holds value better in SA?",
    a: `Short answer: The 3.2 Wildtrak holds value best, but the 2.2 is the smarter buy for most people.

Price: A 2018 3.2 Wildtrak 4x4 sits around R380k - R430k (mid R405k). The equivalent 2.2 XLT is R300k - R350k (mid R325k). The 3.2 depreciates slower in percentage terms because demand for the big diesel never dies - farmers, tour operators, and dads who tow caravans all want it.

Running costs: The 3.2 drinks noticeably more (11-12L/100km vs 8-9L/100km for the 2.2). Services and tyres cost the same, but that fuel gap adds up fast on a Gauteng-to-Durban lifestyle.

Watch out: The 2.2's EGR cooler can fail around 150k km (R8k - R14k). The 3.2's auto box needs oil changes every 60k km - most owners skip this, so check the history.

Sources: Cars.co.za, AutoTrader SA, Ford SA owner groups`,
    chips: [
      { text: "3.2 holds value best", tone: "green" },
      { text: "MEDIUM - EGR cooler", tone: "amber" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Is a 2017 Mercedes C200 a money pit to maintain?",
    a: `Short answer: Honestly? It can be. Budget like you mean it.

Price: 2017 C200s (W205) go for R260k - R320k (mid R290k). That's a lot of badge for the money - which is exactly the trap. The purchase price is the cheapest part of owning this car.

Watch out: The M274 engine's timing chain stretches around 120-150k km (R20k - R35k). The 7G-Tronic gearbox needs services every 60k km that most owners skip (R6k a service, R60k+ for a rebuild). Aircon compressors fail in hot climates - very relevant for a Durban or Nelspruit car (R14k - R20k). And everything electronic costs double what you'd expect.

Rule of thumb: if you can't comfortably budget R25k - R35k a year in maintenance, buy the Toyota instead. No shame in it.

Sources: MyBroadband Merc forum, SA specialist workshops, WeBuyCars`,
    chips: [
      { text: "ABOVE MARKET risk", tone: "red" },
      { text: "HIGH - timing chain", tone: "red" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Honda Jazz vs Hyundai i20 - best reliable runabout under R200k?",
    a: `Short answer: Jazz for reliability, i20 for value. You can't go wrong with either, sharp sharp.

Price: A 2018 Jazz 1.5 Elegance sits around R170k - R200k (mid R185k). An equivalent i20 1.4 Fluid is R150k - R180k (mid R165k) - you get more car for less money with the Hyundai, plus the balance of the 5-year/100,000km warranty if you're lucky.

Reliability: The Jazz is basically appliance-grade - CVT is smooth if the fluid was changed every 40k km (check this, most people don't). The i20's 1.4 is a simple, honest engine with few known issues; early models had some electric power steering niggles (heavy steering warning light - R5k - R9k).

Verdict: Daily Joburg traffic warrior? Jazz. Stretching every rand? i20, and pocket the difference for tyres and services.

Sources: Cars.co.za, Honda SA community, Hyundai SA owner groups`,
    chips: [
      { text: "BOTH SOLID", tone: "green" },
      { text: "LOW - minor niggles", tone: "gray" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "What should I check before buying a used Fortuner 2.8 GD-6?",
    a: `Short answer: They're rarely lemons, but accident history and mileage fraud are the real enemies.

Price: 2019 2.8 GD-6 4x4 models sit around R480k - R560k (mid R520k). Anything far below that deserves serious suspicion - these don't depreciate, so a cheap one is telling you something.

Checklist: First, verify mileage against Toyota SA service records - clocking happens. Second, check the chassis for off-road abuse (bent bash plates, cracked towbar mounts). Third, test every seat fold and the rear aircon - family cars live hard lives. Fourth, the GD-6 injectors: rough cold idle means budget R18k - R28k.

Watch out: Flood-damaged KZN cars from the 2022 floods still circulate. Musty smell, silt under carpets, foggy headlights - walk away immediately.

Why this is lekker: Seven seats, Hilux bones, and you'll sell it in a weekend when the time comes.

Sources: AutoTrader SA, Toyota SA dealer network, WeBuyCars`,
    chips: [
      { text: "8.8 reliability", tone: "green" },
      { text: "CHECK - flood damage", tone: "amber" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Golf 7 GTI with 100,000km - what will break?",
    a: `Short answer: A well-kept one is a joy. A neglected one is a second bond payment.

Price: 2017 GTI models go for R280k - R340k (mid R310k). Full VW service history adds R20k+ to the value - pay it gladly, because the alternative is paying a specialist later.

Watch out: The water pump/thermostat housing leaks around 80-120k km (R8k - R14k, do the timing-adjacent bits while you're in there). Carbon buildup on intake valves dulls performance by 100k km - budget R4k - R7k for a walnut blast. DSG service every 60k km is religion, not advice (R5k a service vs R50k+ mechatronics). And check the turbo for wastegate rattle on cold start.

The test drive: Boost should pull clean to redline with no misfires. If it stutters, either walk away or negotiate R15k off for coils, carbon clean, and prayers.

Sources: MyBroadband VW forum, Cars.co.za GTI reviews, VW specialist workshops`,
    chips: [
      { text: "FAIR at R310k", tone: "amber" },
      { text: "MEDIUM - water pump", tone: "amber" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
];

const ROTATE_MS = 30_000;

const chipStyles: Record<Example["chips"][number]["tone"], string> = {
  green: "border-green-500/20 bg-green-500/10 text-green-400",
  red: "border-red-500/20 bg-red-500/10 text-red-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  gray: "border-gray-700 bg-gray-800 text-gray-400",
};

export function LiveDemo() {
  const { user } = useAuth();
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Rotate through examples every 30s while the visitor is on the page.
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % EXAMPLES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [started]);

  // Typing effect restarts for each example.
  useEffect(() => {
    if (!started) return;
    setTyped("");
    let i = 0;
    const full = EXAMPLES[idx].a;
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
  }, [started, idx]);

  const ex = EXAMPLES[idx];

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
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs tracking-widest uppercase text-gray-500">Example question</p>
              <p className="font-mono text-[11px] text-gray-600">{idx + 1} / {EXAMPLES.length}</p>
            </div>
            <div className="mt-3 rounded-xl border border-gray-800 bg-gray-950 p-4 min-h-[92px]">
              <p key={idx} className="text-sm text-gray-200 leading-relaxed">"{ex.q}"</p>
              <p className="mt-3 text-xs text-gray-500">Demo question to show the kind of answer you will get. Try your own below - no account needed.</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Choose example">
              {EXAMPLES.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === idx}
                  aria-label={`Example ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-orange-500" : "w-1.5 bg-gray-700 hover:bg-gray-500"}`}
                />
              ))}
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
                {ex.chips.map((c) => (
                  <span key={c.text} className={`rounded-full border px-2.5 py-1 text-xs ${c.tone === "green" ? "font-semibold" : ""} ${chipStyles[c.tone]}`}>{c.text}</span>
                ))}
              </div>
            </motion.div>
            <p className="mt-3 text-xs text-gray-600">Example - real answers are grounded in 20-model SA knowledge base and cite sources.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
