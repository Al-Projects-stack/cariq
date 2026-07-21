import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getRecommendations } from "../api";
import type { RecommendModel } from "../types";

const BODY_OPTIONS = [
  { value: "", label: "No preference", icon: "all" },
  { value: "hatchback", label: "Hatchback", icon: "hatchback" },
  { value: "suv", label: "SUV / Crossover", icon: "suv" },
  { value: "bakkie", label: "Bakkie", icon: "bakkie" },
];

const PRIORITY_OPTIONS = [
  { value: "reliability", label: "Reliability" },
  { value: "fuel_economy", label: "Fuel Economy" },
  { value: "low_maintenance", label: "Low Maintenance" },
  { value: "resale_value", label: "Resale Value" },
  { value: "performance", label: "Performance" },
];

const BUDGET_PRESETS = [
  { min: 0, max: 200000, label: "Under R200k" },
  { min: 200000, max: 400000, label: "R200k - R400k" },
  { min: 400000, max: 600000, label: "R400k - R600k" },
  { min: 600000, max: 9999999, label: "R600k+" },
];

function formatZAR(n: number): string {
  return `R${n.toLocaleString("en-ZA")}`;
}

export function RecommendPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [budgetMin, setBudgetMin] = useState(Number(searchParams.get("budget_min")) || 0);
  const [budgetMax, setBudgetMax] = useState(Number(searchParams.get("budget_max")) || 400000);
  const [bodyType, setBodyType] = useState(searchParams.get("body_type") || "");
  const [priorities, setPriorities] = useState<string[]>(searchParams.get("priorities")?.split(",").filter(Boolean) || []);
  const [familySize, setFamilySize] = useState(Number(searchParams.get("family_size")) || 2);
  const [results, setResults] = useState<RecommendModel[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  function togglePriority(val: string) {
    setPriorities((p) =>
      p.includes(val) ? p.filter((v) => v !== val) : p.length < 3 ? [...p, val] : p
    );
  }

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await getRecommendations({
        budget_min: budgetMin,
        budget_max: budgetMax,
        body_type: bodyType || undefined,
        priorities,
        family_size: familySize,
      });
      setResults(res.recommendations);
      setTotalCount(res.total_count);
      setSearchParams({
        budget_min: String(budgetMin),
        budget_max: String(budgetMax),
        body_type: bodyType,
        priorities: priorities.join(","),
        family_size: String(familySize),
      }, { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-3xl font-extrabold text-gray-100 mb-2">Find Your Perfect Car</h1>
        <p className="text-gray-500 mb-8">Tell us what you need and we will find the best match from our knowledge base.</p>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 mb-8">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">Your Budget</p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => { setBudgetMin(p.min); setBudgetMax(p.max); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      budgetMin === p.min && budgetMax === p.max
                        ? "bg-orange-500/20 border-orange-500 text-orange-400"
                        : "border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">Body Type</p>
              <div className="flex flex-wrap gap-2">
                {BODY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setBodyType(o.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      bodyType === o.value
                        ? "bg-orange-500/20 border-orange-500 text-orange-400"
                        : "border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">Priorities (pick up to 3)</p>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((o) => {
                  const active = priorities.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      onClick={() => togglePriority(o.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        active
                          ? "bg-orange-500/20 border-orange-500 text-orange-400"
                          : "border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">Family Size</p>
              <div className="flex gap-2">
                {[1, 2, 4, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setFamilySize(n)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      familySize === n
                        ? "bg-orange-500/20 border-orange-500 text-orange-400"
                        : "border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {n === 6 ? "6+" : n} {n === 1 ? "person" : "people"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-50 transition-all"
          >
            {loading ? "Finding matches..." : "Find My Car"}
          </button>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>

        {results && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-100">Your Matches</h2>
              <span className="text-sm text-gray-500">{totalCount} models found</span>
            </div>
            <div className="space-y-3">
              {results.map((r, i) => (
                <Link
                  key={`${r.make}-${r.model}`}
                  to={`/model/${encodeURIComponent(r.make)}/${encodeURIComponent(r.model.replace(/ /g, "_"))}`}
                  className="block rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-orange-500/50 transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange-500">#{i + 1}</span>
                        <p className="text-xs text-gray-500">{r.make}</p>
                      </div>
                      <p className="text-lg font-bold text-gray-100 group-hover:text-orange-400 transition-colors">{r.model}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-100">{formatZAR(r.mid_zar)}</p>
                      <p className="text-xs text-gray-600">Match: {r.score.toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-600">{r.reliability_score.toFixed(1)} reliability</span>
                    <span className="text-gray-700">|</span>
                    <span className="text-xs text-gray-600 capitalize">{r.segment.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.match_reasons.map((reason, j) => (
                      <span key={j} className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs text-orange-400 border border-orange-500/20">
                        {reason}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
