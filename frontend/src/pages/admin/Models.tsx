import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListModels, adminSoftDelete, adminRestoreModel } from "../../api";
import type { AdminModelListItem } from "../../types";
import { useAdmin } from "../../contexts/AdminContext";
import { Loading, Empty, ErrorBox, Pagination, Toasts, useToasts, inputCls, btnPrimary } from "../../components/admin/ui";

export function AdminModels() {
  const { admin } = useAdmin();
  const { toasts, notify } = useToasts();
  const [items, setItems] = useState<AdminModelListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = admin?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListModels(q, status, page);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q, status, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function remove(slug: string) {
    if (!window.confirm(`Soft-delete ${slug}? It stays in the database and can be restored.`)) return;
    try {
      await adminSoftDelete(slug);
      notify("ok", "Model soft-deleted");
      load();
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function restore(slug: string) {
    try {
      await adminRestoreModel(slug);
      notify("ok", "Model restored");
      load();
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Restore failed");
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <Toasts toasts={toasts} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Knowledge Base</h1>
        <Link to="/admin/models/new" className={btnPrimary()}>+ New model</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search make or model..." className={`${inputCls()} max-w-xs`} aria-label="Search models" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${inputCls()} w-auto`} aria-label="Filter by status">
          {["", "draft", "live", "deleted"].map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
        </select>
      </div>
      {items.length === 0 ? <Empty text="No models found." /> : (
        <div className="overflow-hidden rounded-2xl border border-gray-800">
          <table className="w-full bg-gray-900/60 text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-widest text-gray-500">
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Chunks</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.slug} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <Link to={`/admin/models/${encodeURIComponent(m.slug)}`} className="font-semibold text-gray-100 hover:text-orange-400">
                      {m.make} {m.model}
                    </Link>
                    {m.has_unpublished_changes && <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">unpublished changes</span>}
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{m.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.published_at ? m.published_at.slice(0, 10) : "-"}</td>
                  <td className="px-4 py-3 text-gray-400">{m.chunk_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 text-xs">
                      <Link to={`/admin/models/${encodeURIComponent(m.slug)}`} className="text-orange-400 hover:underline">Edit</Link>
                      {isAdmin && m.status !== "deleted" && <button onClick={() => remove(m.slug)} className="text-red-400 hover:underline">Delete</button>}
                      {isAdmin && m.status === "deleted" && <button onClick={() => restore(m.slug)} className="text-green-400 hover:underline">Restore</button>}
                    </div>
                  </td>
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
