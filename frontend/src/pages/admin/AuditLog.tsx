import { useCallback, useEffect, useState } from "react";
import { adminListAudit } from "../../api";
import { Loading, Empty, ErrorBox, Pagination, inputCls } from "../../components/admin/ui";

interface Row { id: number; actor: string; action: string; model_slug: string | null; detail: string | null; created_at: string }

export function AdminAuditLog() {
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListAudit(action, actor, page);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [action, actor, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-100">Audit Log</h1>
      <p className="text-xs text-gray-500">Append-only. Every admin action is recorded here.</p>
      <div className="flex flex-wrap gap-2">
        <input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="Filter by action..." className={`${inputCls()} max-w-xs`} aria-label="Filter by action" />
        <input value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} placeholder="Filter by actor..." className={`${inputCls()} max-w-xs`} aria-label="Filter by actor" />
      </div>
      {items.length === 0 ? <Empty text="No audit entries." /> : (
        <div className="overflow-hidden rounded-2xl border border-gray-800">
          <table className="w-full bg-gray-900/60 text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-widest text-gray-500">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/50 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">{r.created_at.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-4 py-2 text-gray-300">{r.actor}</td>
                  <td className="px-4 py-2"><span className="rounded-full bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-300">{r.action}</span></td>
                  <td className="px-4 py-2 text-gray-400">{r.model_slug || "-"}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-xs text-gray-500" title={r.detail || ""}>{r.detail || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={total} pageSize={20} onPage={setPage} />
    </div>
  );
}
