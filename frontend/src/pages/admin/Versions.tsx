import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminListVersions, adminRollback } from "../../api";
import { Loading, ErrorBox, Empty, Toasts, useToasts } from "../../components/admin/ui";

interface V { id: number; kind: string; created_by: string; created_at: string }

export function AdminVersions() {
  const { slug } = useParams();
  const { toasts, notify } = useToasts();
  const [items, setItems] = useState<V[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListVersions(slug as string);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function rollback(id: number) {
    if (!window.confirm(`Restore version ${id} as a new draft? Current draft content will be replaced.`)) return;
    try {
      await adminRollback(slug as string, id);
      notify("ok", "Rolled back as new draft");
      load();
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Rollback failed");
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <Toasts toasts={toasts} />
      <div className="flex items-center gap-3">
        <Link to={`/admin/models/${encodeURIComponent(slug as string)}`} className="text-sm text-gray-500 hover:text-orange-400">← Editor</Link>
        <h1 className="text-xl font-bold text-gray-100">Version history</h1>
      </div>
      {items.length === 0 ? <Empty text="No versions yet." /> : (
        <div className="space-y-2">
          {items.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
              <div className="text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs ${v.kind === "published" ? "bg-green-500/15 text-green-300" : "bg-gray-800 text-gray-400"}`}>
                  {v.kind}
                </span>
                <span className="ml-3 text-gray-400">#{v.id} · {v.created_by || "unknown"} · {v.created_at.slice(0, 16).replace("T", " ")}</span>
              </div>
              <button onClick={() => rollback(v.id)} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-orange-500/50 hover:text-orange-400">
                Rollback to this
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
