import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { listSavedSearches, deleteSavedSearch } from "../api";
import type { SavedSearchItem } from "../types";

export function History() {
  const [items, setItems] = useState<SavedSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await listSavedSearches();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: number) {
    await deleteSavedSearch(id).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const filtered = items.filter((i) => {
    const q = filter.toLowerCase();
    return !q || i.query.toLowerCase().includes(q) || i.label.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">History</h1>
            <p className="mt-1 text-sm text-gray-500">{items.length} saved searches</p>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter searches..."
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 w-full sm:w-64"
          />
        </div>

        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-gray-500 text-sm">
            <svg className="h-5 w-5 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading history...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-800/60 bg-red-950/40 px-5 py-4 text-sm text-red-300">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-10 text-center">
            <p className="text-sm text-gray-400">{items.length === 0 ? "No saved searches yet." : "No matches."}</p>
            <p className="text-xs text-gray-600 mt-1">Ask a question on the home page and save it to see it here.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 flex gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{item.label || item.query}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.query}</p>
                  <p className="text-xs text-gray-600 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                  {item.filters !== "{}" && <p className="text-xs text-gray-700 mt-1 truncate font-mono">{item.filters}</p>}
                </div>
                <button onClick={() => handleDelete(item.id)} className="shrink-0 text-xs text-gray-500 hover:text-red-400 self-start">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
