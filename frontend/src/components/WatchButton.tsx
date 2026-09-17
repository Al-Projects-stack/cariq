import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { listWatchlist, addWatchlist, removeWatchlist } from "../api";

export function WatchButton({ make, model, size = "sm" }: { make: string; model: string; size?: "sm" | "md" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [watching, setWatching] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!user) {
      setWatching(false);
      setWatchId(null);
      setInitialised(true);
      return;
    }
    listWatchlist()
      .then((data) => {
        const found = data.items.find((i) => i.make === make && i.model === model);
        if (found) {
          setWatching(true);
          setWatchId(found.id);
        } else {
          setWatching(false);
          setWatchId(null);
        }
      })
      .catch(() => {})
      .finally(() => setInitialised(true));
  }, [user, make, model]);

  async function toggle() {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      if (watching && watchId) {
        await removeWatchlist(watchId);
        setWatching(false);
        setWatchId(null);
      } else {
        const item = await addWatchlist(make, model);
        setWatching(true);
        setWatchId(item.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Already watching")) {
        // re-sync
        const data = await listWatchlist().catch(() => null);
        const found = data?.items.find((i) => i.make === make && i.model === model);
        if (found) {
          setWatching(true);
          setWatchId(found.id);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const dim = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const iconSize = size === "md" ? "h-5 w-5" : "h-4 w-4";

  return (
    <button
      onClick={toggle}
      disabled={!initialised && !!user}
      title={watching ? "Remove from watchlist" : "Add to watchlist"}
      className={`${dim} rounded-full border flex items-center justify-center transition-all shrink-0 ${
        watching ? "bg-orange-500 border-orange-500 text-white" : "border-gray-700 bg-gray-900 text-gray-400 hover:border-orange-500/50 hover:text-orange-400"
      } ${loading ? "opacity-50" : ""}`}
    >
      <svg className={iconSize} fill={watching ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  );
}
