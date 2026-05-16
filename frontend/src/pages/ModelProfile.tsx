import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getModelProfile } from "../api";
import type { CarProfile } from "../types";

const SEVERITY_COLOURS: Record<string, string> = {
  HIGH: "text-red-400 border-red-800 bg-red-950/40",
  MEDIUM: "text-amber-400 border-amber-800 bg-amber-950/40",
  LOW: "text-green-400 border-green-800 bg-green-950/40",
};

function formatZAR(n: number): string {
  return `R${n.toLocaleString("en-ZA")}`;
}

function ReliabilityScore({ score }: { score: number }) {
  const colour = score >= 8.5 ? "text-green-400" : score >= 7 ? "text-blue-400" : "text-amber-400";
  return (
    <span className={`text-4xl font-black ${colour}`}>
      {score.toFixed(1)}<span className="text-xl text-gray-600">/10</span>
    </span>
  );
}

export function ModelProfile() {
  const { make, model } = useParams<{ make: string; model: string }>();
  const [profile, setProfile] = useState<CarProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!make || !model) return;
    setLoading(true);
    getModelProfile(make, model)
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [make, model]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || "Model not found"}</p>
        <Link to="/" className="text-sm text-orange-500 hover:underline">← Back to CarIQ</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-900 px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to CarIQ
          </Link>
          <span className="text-xl font-extrabold">
            <span className="text-orange-500">Car</span>
            <span className="text-white">IQ</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-1">{profile.make}</p>
          <h1 className="text-4xl font-extrabold text-gray-100">{profile.model}</h1>
          <p className="mt-1 text-sm text-gray-500">{profile.years_covered}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">SA Market Overview</h2>
            <p className="text-gray-300 leading-relaxed">{profile.sa_market_summary}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col items-center justify-center gap-2">
            <p className="text-sm text-gray-500 uppercase tracking-widest">Reliability</p>
            <ReliabilityScore score={profile.reliability_score} />
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">Price Ranges (SA Market)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-600 border-b border-gray-800">
                  <th className="pb-2 text-left font-medium">Years</th>
                  <th className="pb-2 text-right font-medium">Low</th>
                  <th className="pb-2 text-right font-medium">Mid</th>
                  <th className="pb-2 text-right font-medium">High</th>
                </tr>
              </thead>
              <tbody>
                {profile.price_ranges.map((pr, i) => (
                  <tr key={i} className="border-b border-gray-800/50 last:border-0">
                    <td className="py-3 text-gray-300">{pr.year_from}–{pr.year_to}</td>
                    <td className="py-3 text-right text-green-400">{formatZAR(pr.low_zar)}</td>
                    <td className="py-3 text-right text-blue-400 font-semibold">{formatZAR(pr.mid_zar)}</td>
                    <td className="py-3 text-right text-gray-400">{formatZAR(pr.high_zar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">Known Faults</h2>
          <div className="space-y-5">
            {profile.known_faults.map((fault, i) => (
              <div key={i} className="border-b border-gray-800 pb-5 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-semibold text-gray-100">{fault.fault}</p>
                  <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOURS[fault.severity]}`}>
                    {fault.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-3">{fault.description}</p>
                <div className="grid sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-gray-600 mb-1">Mileage range</p>
                    <p className="text-gray-300">{fault.mileage_range}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Repair cost</p>
                    <p className="text-orange-400">{fault.estimated_repair_zar}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Affects</p>
                    <p className="text-gray-300">{fault.affects_variants.join(", ")}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-gray-800/50 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">What to inspect</p>
                  <p className="text-xs text-gray-300">{fault.what_to_inspect}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">Before You Buy — Checklist</h2>
          <ul className="space-y-2">
            {profile.what_to_inspect_before_buying.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Owner Sentiment</h2>
          <p className="text-gray-300 leading-relaxed">{profile.owner_sentiment}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.sources.map((s, i) => (
              <span key={i} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-500 border border-gray-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-orange-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
