import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CarVariant } from "../types";

interface Props {
  models: CarVariant[];
}

function ReliabilityBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const colour =
    score >= 8.5 ? "bg-green-500" : score >= 7 ? "bg-blue-500" : score >= 5.5 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-800">
        <div className={`h-1.5 rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{score.toFixed(1)}</span>
    </div>
  );
}

export function ModelSearch({ models }: Props) {
  const [search, setSearch] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const navigate = useNavigate();

  const filtered = models.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.make.toLowerCase().includes(q) ||
      m.model.toLowerCase().includes(q) ||
      m.variants.some((v) => v.toLowerCase().includes(q))
    );
  });

  function toggleSelect(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length < 2 ? [...prev, key] : prev
    );
  }

  function handleCompare() {
    if (selected.length !== 2) return;
    const [a, b] = selected.map((key) => {
      const parts = key.split("|");
      return { make: parts[0], model: parts[1] };
    });
    navigate(`/compare?make_a=${encodeURIComponent(a.make)}&model_a=${encodeURIComponent(a.model)}&make_b=${encodeURIComponent(b.make)}&model_b=${encodeURIComponent(b.model)}`);
  }

  return (
    <div className="mt-16">
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-100">Model Browser</h2>
            <p className="mt-1 text-sm text-gray-500">{models.length} models in the knowledge base</p>
          </div>
          <button
            onClick={() => { setCompareMode((v) => !v); if (compareMode) setSelected([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 ${
              compareMode
                ? "bg-orange-500/20 border-orange-500 text-orange-400"
                : "border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            {compareMode ? "Exit Compare" : "Compare"}
          </button>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {compareMode && selected.length === 2 && (
            <button
              onClick={handleCompare}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 transition-all"
            >
              Compare Selected
            </button>
          )}
          <input
            type="text"
            placeholder="Filter models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              rounded-lg border border-gray-700 bg-gray-900
              px-4 py-2 text-sm text-gray-200 placeholder-gray-600
              focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500
              w-full sm:w-56
            "
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No models match "{search}"</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((car) => {
            const key = `${car.make}|${car.model}`;
            const isSelected = selected.includes(key);
            return (
              <div key={key} className="relative">
                {compareMode && (
                  <button
                    onClick={() => toggleSelect(key)}
                    className={`absolute top-3 left-3 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-orange-500 border-orange-500"
                        : "border-gray-600 hover:border-orange-400 bg-gray-900/80"
                    }`}
                  >
                    {isSelected && (
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}
                <Link
                  to={compareMode ? "#" : `/model/${encodeURIComponent(car.make)}/${encodeURIComponent(car.model.replace(/ /g, "_"))}`}
                  onClick={compareMode ? (e) => { e.preventDefault(); toggleSelect(key); } : undefined}
                  className={`group rounded-xl border p-4 transition-all duration-200 block ${
                    isSelected
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-gray-800 bg-gray-900 hover:border-orange-500/50 hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500">{car.make}</p>
                      <p className={`font-semibold transition-colors ${isSelected ? "text-orange-400" : "text-gray-100 group-hover:text-orange-400"}`}>
                        {car.model}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{car.years_covered}</p>
                    </div>
                    <ArrowIcon />
                  </div>
                  <ReliabilityBar score={car.reliability_score} />
                  <p className="mt-1 text-xs text-gray-600">Reliability</p>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4 text-gray-600 group-hover:text-orange-500 transition-colors mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
