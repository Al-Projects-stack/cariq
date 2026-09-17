import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import { listWatchlist, removeWatchlist } from "../api";
import type { WatchlistItem } from "../types";

export function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listWatchlist();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRemove(id: number) {
    await removeWatchlist(id).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-100">Your Watchlist</h1>
        <p className="mt-1 text-sm text-gray-500">{items.length} models watched</p>

        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-gray-500 text-sm">
            <svg className="h-5 w-5 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading watchlist...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-800/60 bg-red-950/40 px-5 py-4 text-sm text-red-300">{error}</div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-10 text-center">
            <p className="text-sm text-gray-400">No models watched yet.</p>
            <p className="text-xs text-gray-600 mt-1">Browse models and tap the heart to keep track.</p>
            <Link to="/#models" className="mt-6 inline-block rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400">
              Browse models
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-col">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">{item.make}</p>
                    <p className="font-semibold text-gray-100">{item.model}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleRemove(item.id)} className="text-xs text-gray-500 hover:text-red-400" title="Remove">
                    Remove
                  </button>
                </div>
                <Link
                  to={`/model/${encodeURIComponent(item.make)}/${encodeURIComponent(item.model.replace(/ /g, "_"))}`}
                  className="mt-4 inline-flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-200 hover:border-orange-500/50 hover:text-orange-400 transition-colors"
                >
                  View profile
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
