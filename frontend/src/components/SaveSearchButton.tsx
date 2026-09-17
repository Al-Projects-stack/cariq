import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { saveSearch } from "../api";

export function SaveSearchButton({ query }: { query: string }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/")}`;
      return;
    }
    if (saving || saved) return;
    setSaving(true);
    setError(null);
    try {
      await saveSearch(query);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={saving || saved}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          saved ? "border-green-800 bg-green-950/40 text-green-400" : "border-gray-700 bg-gray-900 text-gray-300 hover:border-orange-500/50 hover:text-orange-400"
        }`}
      >
        <svg className="h-4 w-4" fill={saved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        {saved ? "Saved" : saving ? "Saving..." : "Save search"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
      {!user && <span className="text-xs text-gray-600">Sign in to save</span>}
    </div>
  );
}
