import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface Example {
  q: string;
  a: string;
  chips: { text: string; tone: "green" | "red" | "gray" | "amber" }[];
}

// Prices, severities and repair costs below mirror backend/knowledge_base/cars/*.json
// (Oct 2026 re-price). Update these if the KB bands change.
const EXAMPLES: Example[] = [
  {
    q: "Is R185k fair for a 2019 Polo 1.0 TSI in Cape Town?",
    a: `Short answer: Yep - that's a GOOD DEAL if it has a clean service history.

Price: 2018-2020 Polos sit around R180k - R270k (mid R220k). R185k is near the bottom of the band, so you're not being taken for a ride. A price that low usually means a base Trendline or higher mileage - check the spec and the km before you celebrate.

Watch out: The 7-speed DSG can hesitate and shudder in stop-start traffic around 50-100k km - feels like a kangaroo at the robot. Ask when the gearbox oil was last done. Budget R5k - R18k (fluid service to mechatronic unit). The 1.0 TSI water pump is the bigger one: it fails around 70-100k km and can overheat the engine - R3k - R6k to replace, so ask if it's been done.

Why this is lekker: Polo holds value like a Hilux holds grudges. Resale is strong and parts are everywhere - from Bellville to Boksburg.

Sources: Cars.co.za, AutoTrader SA, MyBroadband`,
    chips: [
      { text: "GOOD DEAL", tone: "green" },
      { text: "HIGH - water pump", tone: "red" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "What are the known faults on a 2016 Toyota Hilux 2.8 GD-6?",
    a: `Short answer: Very few - that's why they hold value like property in Sandton.

Known faults: The 2.8 GD-6 is one of Toyota's most solid bakkie engines. The main one is EGR valve and DPF soot buildup between 60-120k km, especially on bakkies that only did short Joburg school runs (R3k - R12k, cleaning to EGR replacement). The turbo actuator can fail around 80-150k km (R6k - R18k). Past 100k km, check for weeping injector seals - a cheap fix at R1.5k - R4k if caught early.

What to check: Full Toyota service history is non-negotiable. Look for a clean load bin (no cracks = wasn't overloaded), inspect the front leaf springs if it lived on gravel, and test 4x4 engagement.

Why this is lekker: 2016-2018 Hiluxes still fetch around R320k - R470k (mid R380k). Buy right and you'll sell it for close to what you paid.

Sources: Cars.co.za, SA Bakkie forum, WeBuyCars`,
    chips: [
      { text: "9.0 reliability", tone: "green" },
      { text: "MEDIUM - EGR/DPF soot", tone: "amber" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Should I buy a 2015 BMW 320i with 120,000km for R170k?",
    a: `Short answer: On price it's a GOOD DEAL - but at this mileage, ask why it's so cheap.

Price: The 2014-2016 320i (F30) band sits around R170k - R290k (mid R220k). R170k is right at the bottom, which usually means high km, skipped services, or accident history. Get the full story before you get excited.

Watch out: The N20 timing chain and tensioner is THE issue at 80-120k km - this car is right in the window. Listen for a rattle on cold start; if you hear it, walk away or budget R12k - R22k. The electric water pump also likes to retire around 60-100k km (R4.5k - R9k), and valve cover gaskets leak oil past 60k km. Get a pre-purchase inspection at a BMW specialist, not the seller's buddy.

Why it's tempting: Nothing drives like it at this price. Just keep a healthy maintenance fund on top of the purchase.

Sources: MyBroadband BMW forum, AutoTrader SA, SA BMW specialist workshops`,
    chips: [
      { text: "GOOD DEAL - ask why", tone: "green" },
      { text: "HIGH - timing chain", tone: "red" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Ford Ranger 2.2 vs 3.2 - which holds value better in SA?",
    a: `Short answer: The 3.2 Wildtrak holds value best, but the 2.2 is the smarter buy for most people.

Price: 2016-2018 Rangers sit around R250k - R390k (mid R310k). A 2018 3.2 Wildtrak 4x4 lives at the top of that band; an equivalent 2.2 XLT sits closer to the mid. The 3.2 depreciates slower in percentage terms because demand for the big diesel never dies - farmers, tour operators, and dads who tow caravans all want it.

Running costs: The 3.2 drinks noticeably more than the 2.2. Services and tyres cost about the same, but that fuel gap adds up fast on a Gauteng-to-Durban lifestyle.

Watch out: The 2.2's water pump can fail around 80-120k km (R3.5k - R8k). Both engines suffer EGR valve problems from 80k km (R2k - R7k). On manuals, the dual mass flywheel wears out around 100-150k km - budget R14k - R28k for a DMF and clutch kit.

Sources: Cars.co.za, AutoTrader SA, SA Ranger Owners Forum`,
    chips: [
      { text: "3.2 holds value best", tone: "green" },
      { text: "HIGH - DMF wear", tone: "red" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Is a 2017 Mercedes C200 a money pit to maintain?",
    a: `Short answer: Honestly? It can be. Budget like you mean it.

Price: 2017-2019 C-Class (W205) models go for R300k - R480k (mid R380k), with a 2017 sitting in the lower half. That's a lot of badge for the money - which is exactly the trap. The purchase price is the cheapest part of owning this car.

Watch out: The 7G-Tronic Plus gearbox valve body is the big one around 80-120k km - jerky shifts or hunting between gears mean R12k - R45k. Petrol engines can burn oil past 60k km - check the dipstick and ask how often it's topped up. Blocked sunroof drains leak water into the footwells and can fry electronics (R500 to R15k+). And on high-spec cars with air suspension, strut work runs R15k - R60k per axle.

Rule of thumb: if you can't comfortably budget for a gearbox service every 60,000km and a surprise or two, buy the Toyota instead. No shame in it.

Sources: MyBroadband Merc forum, SA independent Mercedes specialists, WeBuyCars`,
    chips: [
      { text: "5.8 reliability", tone: "red" },
      { text: "HIGH - 7G-Tronic gearbox", tone: "red" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Honda Jazz vs Hyundai i20 - best reliable runabout under R200k?",
    a: `Short answer: Jazz for reliability, i20 for value. You can't go wrong with either, sharp sharp.

Price: 2015-2018 Jazz models sit around R130k - R205k (mid R165k). A 2018-2020 i20 is R125k - R215k (mid R170k) - similar money, but you get a newer car with the Hyundai.

Reliability: The Jazz is basically appliance-grade (9.0 reliability) - the CVT is smooth if the fluid was changed on time; shudder means anything from R1.5k for fluid to R25k+ for a rebuild. The i20 (8.0) is a simple, honest car; on the 1.0 T-GDi, check for turbo wear past 80k km (R8k - R18k), and test the aircon - compressors can go (R6k - R12k).

Verdict: Daily Joburg traffic warrior? Jazz. Stretching every rand? i20, and pocket the difference for tyres and services.

Sources: Cars.co.za, SA Honda owners community, SA Hyundai owners community`,
    chips: [
      { text: "BOTH SOLID", tone: "green" },
      { text: "MEDIUM - CVT / turbo", tone: "amber" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "What should I check before buying a used Fortuner 2.8 GD-6?",
    a: `Short answer: They're rarely lemons, but a neglected gearbox and mileage fraud are the real enemies.

Price: 2019-2021 Fortuners sit around R450k - R640k (mid R520k). Anything far below that deserves serious suspicion - these don't depreciate, so a cheap one is telling you something.

Checklist: First, verify mileage against Toyota SA service records - clocking happens. Second, check the automatic gearbox has had its fluid services; neglect is the HIGH-risk item here (R2k for a service, up to R45k for a rebuild). Third, city-driven diesels clog the DPF and EGR between 60-120k km (R4k - R15k). Fourth, on 4x4s, listen for wheel bearing hum (R2.5k - R6k per bearing) and check the rear shocks.

Watch out: Flood-damaged KZN cars still circulate. Musty smell, silt under carpets, foggy headlights - walk away immediately.

Why this is lekker: Seven seats, Hilux bones, and you'll sell it in a weekend when the time comes.

Sources: AutoTrader SA, Toyota SA dealer network, WeBuyCars`,
    chips: [
      { text: "8.8 reliability", tone: "green" },
      { text: "HIGH - gearbox neglect", tone: "red" },
      { text: "Sources: 3", tone: "gray" },
    ],
  },
  {
    q: "Golf 7 GTI with 100,000km - what will break?",
    a: `Short answer: A well-kept one is a joy. A neglected one is a second bond payment.

Price: 2017-2019 Golfs go for R220k - R400k (mid R300k), with GTIs at the upper end. Full VW service history adds real value - pay it gladly, because the alternative is paying a specialist later.

Watch out: The DSG7 mechatronic unit is the big one between 60-120k km (R8k - R25k) - DSG service on schedule is religion, not advice. At 100k km you're also in EA888 timing chain stretch territory (R12k - R22k) - listen for a rattle on cold start. Carbon buildup on the intake valves dulls performance (R3.5k - R7k for a clean), and turbos on modified or high-km cars can go (R15k - R35k).

The test drive: Boost should pull clean to redline with no misfires. If it stutters, either walk away or negotiate hard.

Sources: MyBroadband VW forum, Cars.co.za, VW SA dealer network`,
    chips: [
      { text: "7.8 reliability", tone: "amber" },
      { text: "HIGH - DSG mechatronic", tone: "red" },
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
  const doneTyping = started && typed === ex.a;

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
          <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase text-gray-600">
            {doneTyping ? "answered" : "typing…"}
          </span>
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
                Sign up to save searches and cars
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
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-200">{typed}{!doneTyping && <span className="inline-block h-4 w-1.5 bg-orange-500 ml-0.5 animate-pulse align-middle" />}</pre>
              <div className="mt-4 flex flex-wrap gap-2">
                {ex.chips.map((c) => (
                  <span key={c.text} className={`rounded-full border px-2.5 py-1 text-xs ${c.tone === "green" ? "font-semibold" : ""} ${chipStyles[c.tone]}`}>{c.text}</span>
                ))}
              </div>
            </motion.div>
            <p className="mt-3 text-xs text-gray-600">Example - real answers are grounded in the CarIQ SA knowledge base and cite sources.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
