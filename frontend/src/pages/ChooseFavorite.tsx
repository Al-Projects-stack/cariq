import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "../components/Header";
import { CarImage } from "../components/CarImage";
import { useAuth } from "../contexts/AuthContext";
import { listModels, addWatchlist } from "../api";
import type { CarVariant } from "../types";

export function ChooseFavorite() {
  const { favoriteCar, setFavoriteCar } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const navigate = useNavigate();
  const [models, setModels] = useState<CarVariant[]>([]);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    listModels().then(setModels).catch(() => {});
  }, []);

  // already picked (e.g. direct visit) - carry on
  useEffect(() => {
    if (favoriteCar) navigate(next, { replace: true });
  }, [favoriteCar, next, navigate]);

  const q = filter.toLowerCase();
  const filtered = models.filter((m) => `${m.make} ${m.model}`.toLowerCase().includes(q));

  async function choose(make: string, model: string) {
    if (saving) return;
    setSaving(`${make}|${model}`);
    setFavoriteCar({ make, model });
    try {
      await addWatchlist(make, model);
    } catch {
      // favourite is still saved locally - watchlist sync is a bonus
    }
    navigate(next, { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-extrabold text-gray-100">Pick your favourite car</h1>
        <p className="mt-2 text-sm text-gray-500">
          One tap, sharp sharp. It becomes your blurry backdrop across CarIQ - and lands on your watchlist too.
        </p>

        <input
          type="text"
          placeholder="Filter models..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mt-6 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 sm:max-w-xs"
        />

        {models.length === 0 ? (
          <p className="mt-8 text-sm text-gray-500">Loading models...</p>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-sm text-gray-500">No models match "{filter}"</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((car) => {
              const key = `${car.make}|${car.model}`;
              const busy = saving === key;
              return (
                <button
                  key={key}
                  onClick={() => choose(car.make, car.model)}
                  disabled={saving !== null}
                  className="group overflow-hidden rounded-xl border border-gray-800 bg-gray-900 text-left transition-all duration-200 hover:border-orange-500/60 hover:bg-gray-800 disabled:opacity-60"
                >
                  <CarImage make={car.make} model={car.model} className="aspect-[16/9] w-full" />
                  <div className="p-4">
                    <p className="text-xs font-medium text-gray-500">{car.make}</p>
                    <p className="font-semibold text-gray-100 group-hover:text-orange-400 transition-colors">
                      {busy ? "Saving..." : car.model}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{car.years_covered}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
