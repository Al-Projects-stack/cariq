import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { compareModels } from "../api";
import type { CompareResponse } from "../types";

function formatZAR(n: number): string {
  return `R${n.toLocaleString("en-ZA")}`;
}

export function ComparePage() {
  const [searchParams] = useSearchParams();
  const makeA = searchParams.get("make_a") || "";
  const modelA = searchParams.get("model_a") || "";
  const makeB = searchParams.get("make_b") || "";
  const modelB = searchParams.get("model_b") || "";

  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!makeA || !modelA || !makeB || !modelB) {
      setError("Select two models to compare.");
      setLoading(false);
      return;
    }
    setLoading(true);
    compareModels(makeA, modelA, makeB, modelB)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [makeA, modelA, makeB, modelB]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Loading comparison...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || "Comparison failed"}</p>
        <Link to="/" className="text-sm text-orange-500 hover:underline">← Back to CarIQ</Link>
      </div>
    );
  }

  const { model_a, model_b, reliability, price, faults } = data;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-900 px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
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

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-extrabold text-gray-100 mb-8">Model Comparison</h1>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <ModelCard profile={model_a} />
          <ModelCard profile={model_b} />
        </div>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">Reliability</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <ScoreCard label={model_a.make + " " + model_a.model} score={reliability.a_score} winner={reliability.winner === model_a.make + " " + model_a.model} />
            <ScoreCard label={model_b.make + " " + model_b.model} score={reliability.b_score} winner={reliability.winner === model_b.make + " " + model_b.model} />
          </div>
          <p className="mt-4 text-sm text-gray-400">
            {reliability.winner} is more reliable by {reliability.gap.toFixed(1)} points.
          </p>
        </section>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">Price (Latest Year Band)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-600 border-b border-gray-800">
                  <th className="pb-2 text-left font-medium"></th>
                  <th className="pb-2 text-right font-medium">Low</th>
                  <th className="pb-2 text-right font-medium">Mid</th>
                  <th className="pb-2 text-right font-medium">High</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50">
                  <td className="py-3 font-medium text-gray-100">{model_a.make} {model_a.model}</td>
                  <td className="py-3 text-right text-green-400">{formatZAR(price.a_low_zar)}</td>
                  <td className={`py-3 text-right font-semibold ${price.price_leader === model_a.make + " " + model_a.model ? "text-orange-400" : "text-blue-400"}`}>{formatZAR(price.a_mid_zar)}</td>
                  <td className="py-3 text-right text-gray-400">{formatZAR(price.a_high_zar)}</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-gray-100">{model_b.make} {model_b.model}</td>
                  <td className="py-3 text-right text-green-400">{formatZAR(price.b_low_zar)}</td>
                  <td className={`py-3 text-right font-semibold ${price.price_leader === model_b.make + " " + model_b.model ? "text-orange-400" : "text-blue-400"}`}>{formatZAR(price.b_mid_zar)}</td>
                  <td className="py-3 text-right text-gray-400">{formatZAR(price.b_high_zar)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-gray-400">
            {price.price_leader} is cheaper by {formatZAR(price.price_gap_zar)} at mid-range.
          </p>
        </section>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">Known Faults</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-3">{model_a.make} {model_a.model}</p>
              <div className="space-y-2 text-sm">
                <p className="flex justify-between"><span className="text-gray-400">Total faults</span><span className="text-gray-100 font-semibold">{faults.a_total}</span></p>
                <p className="flex justify-between"><span className="text-red-400">High severity</span><span className="text-red-400 font-semibold">{faults.a_high}</span></p>
                <p className="flex justify-between"><span className="text-amber-400">Medium severity</span><span className="text-amber-400 font-semibold">{faults.a_medium}</span></p>
                <p className="flex justify-between"><span className="text-green-400">Low severity</span><span className="text-green-400 font-semibold">{faults.a_low}</span></p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-3">{model_b.make} {model_b.model}</p>
              <div className="space-y-2 text-sm">
                <p className="flex justify-between"><span className="text-gray-400">Total faults</span><span className="text-gray-100 font-semibold">{faults.b_total}</span></p>
                <p className="flex justify-between"><span className="text-red-400">High severity</span><span className="text-red-400 font-semibold">{faults.b_high}</span></p>
                <p className="flex justify-between"><span className="text-amber-400">Medium severity</span><span className="text-amber-400 font-semibold">{faults.b_medium}</span></p>
                <p className="flex justify-between"><span className="text-green-400">Low severity</span><span className="text-green-400 font-semibold">{faults.b_low}</span></p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">SA Market Overview</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-2">{model_a.make} {model_a.model}</p>
              <p className="text-sm text-gray-300 leading-relaxed">{model_a.sa_market_summary}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">{model_b.make} {model_b.model}</p>
              <p className="text-sm text-gray-300 leading-relaxed">{model_b.sa_market_summary}</p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">Owner Sentiment</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-2">{model_a.make} {model_a.model}</p>
              <p className="text-sm text-gray-300 leading-relaxed">{model_a.owner_sentiment}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">{model_b.make} {model_b.model}</p>
              <p className="text-sm text-gray-300 leading-relaxed">{model_b.owner_sentiment}</p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">Before You Buy Checklists</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-2">{model_a.make} {model_a.model}</p>
              <ul className="space-y-2">
                {model_a.what_to_inspect_before_buying.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">{model_b.make} {model_b.model}</p>
              <ul className="space-y-2">
                {model_b.what_to_inspect_before_buying.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ModelCard({ profile }: { profile: CompareResponse["model_a"] }) {
  const colour = profile.reliability_score >= 8.5 ? "text-green-400" : profile.reliability_score >= 7 ? "text-blue-400" : "text-amber-400";
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <p className="text-xs font-medium text-gray-500">{profile.make}</p>
      <p className="text-2xl font-extrabold text-gray-100 mt-1">{profile.model}</p>
      <p className="text-sm text-gray-500 mt-1">{profile.years_covered} · {profile.variants.length} variants</p>
      <div className="mt-4 flex items-end gap-3">
        <span className={`text-3xl font-black ${colour}`}>{profile.reliability_score.toFixed(1)}</span>
        <span className="text-sm text-gray-600 mb-1">/10 reliability</span>
      </div>
      <Link
        to={`/model/${encodeURIComponent(profile.make)}/${encodeURIComponent(profile.model.replace(/ /g, "_"))}`}
        className="mt-4 inline-block text-xs text-orange-500 hover:text-orange-400 hover:underline"
      >
        View full profile →
      </Link>
    </div>
  );
}

function ScoreCard({ label, score, winner }: { label: string; score: number; winner: boolean }) {
  const colour = score >= 8.5 ? "text-green-400" : score >= 7 ? "text-blue-400" : "text-amber-400";
  const pct = (score / 10) * 100;
  return (
    <div className={`rounded-lg border p-4 ${winner ? "border-orange-500/50 bg-orange-500/5" : "border-gray-800 bg-gray-900"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-100">{label}</p>
        {winner && <span className="text-xs text-orange-400 font-semibold">WINNER</span>}
      </div>
      <span className={`text-2xl font-black ${colour}`}>{score.toFixed(1)}</span>
      <div className="mt-2 h-2 rounded-full bg-gray-800">
        <div className={`h-2 rounded-full ${colour.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
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
