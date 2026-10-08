import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListFailureGroups, adminGetFailureGroup, adminResolveGroup, adminPrefillFromGroup } from "../../api";
import type { FailureGroup } from "../../types";
import { Card, Loading, Empty, ErrorBox, Pagination, Toasts, useToasts, inputCls, btnPrimary, btnGhost } from "../../components/admin/ui";

const REASONS = ["", "model_not_in_kb", "low_score", "user_unhelpful", "system_error"];
const STATUSES = ["", "open", "resolved"];

export function AdminFailedQuestions() {
  const { toasts, notify } = useToasts();
  const [items, setItems] = useState<FailureGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminGetFailureGroup>> | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListFailureGroups(reason, status, page);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [reason, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function openRow(id: number) {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    try {
      setDetail(await adminGetFailureGroup(id));
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Failed to load detail");
    }
  }

  async function resolve(id: number) {
    try {
      await adminResolveGroup(id, note);
      notify("ok", "Marked as resolved");
      setOpenId(null);
      setDetail(null);
      setNote("");
      load();
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Resolve failed");
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <Toasts toasts={toasts} />
      <h1 className="text-xl font-bold text-gray-100">Failed Questions</h1>
      <div className="flex flex-wrap gap-2">
        <select value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }} className={`${inputCls()} w-auto`} aria-label="Filter by reason">
          {REASONS.map((r) => <option key={r} value={r}>{r || "All reasons"}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${inputCls()} w-auto`} aria-label="Filter by status">
          {STATUSES.map((s) => <option key={s} value={s}>{s || "Open + resolved"}</option>)}
        </select>
      </div>
      {items.length === 0 ? <Empty text="No failed questions. Lekker!" /> : (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-widest text-gray-500">
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">×</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <Fragment key={g.id}>
                  <tr onClick={() => openRow(g.id)} className="cursor-pointer border-b border-gray-800/50 hover:bg-gray-800/40">
                    <td className="max-w-md truncate px-4 py-3 text-gray-200">{g.sample_question}</td>
                    <td className="px-4 py-3 text-gray-400">{g.count}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{g.reason}</span></td>
                    <td className="px-4 py-3 text-gray-400">{g.avg_top_score ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${g.status === "open" ? "bg-amber-500/15 text-amber-300" : "bg-green-500/15 text-green-300"}`}>
                        {g.status}
                      </span>
                    </td>
                  </tr>
                  {openId === g.id && (
                    <tr>
                      <td colSpan={5} className="bg-gray-950/60 px-4 py-4">
                        {!detail ? <p className="text-xs text-gray-500">Loading detail...</p> : (
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs uppercase tracking-widest text-gray-500">Retrieved chunks (latest query)</p>
                              {detail.chunks.length === 0 ? <p className="mt-1 text-xs text-gray-500">No chunks recorded.</p> : (
                                <ul className="mt-1 space-y-1">
                                  {detail.chunks.map((c) => (
                                    <li key={c.id} className="rounded bg-gray-900 px-2 py-1 font-mono text-xs text-gray-400">
                                      {c.id} <span className="text-orange-400">{c.score ?? "-"}</span>
                                      {c.text && <span className="block truncate text-gray-600">{c.text}</span>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolve note (optional)" className={`${inputCls()} max-w-xs`} />
                              <button onClick={() => resolve(g.id)} className={btnPrimary()}>Resolve</button>
                              <PrefillButton groupId={g.id} notify={notify} />
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination page={page} total={total} pageSize={20} onPage={setPage} />
    </div>
  );
}

function PrefillButton({ groupId, notify }: { groupId: number; notify: (k: "ok" | "err", t: string) => void }) {
  const [link, setLink] = useState<string | null>(null);
  async function run() {
    try {
      const res = await adminPrefillFromGroup(groupId);
      sessionStorage.setItem("cariq_prefill", JSON.stringify(res.prefill));
      setLink(`/admin/models/new?prefill=1${res.detected_make ? `&make=${encodeURIComponent(res.detected_make)}&model=${encodeURIComponent(res.detected_model || "")}` : ""}`);
      notify("ok", res.detected_make ? `Detected ${res.detected_make} ${res.detected_model}` : "Prefill ready (no model detected)");
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Prefill failed");
    }
  }
  if (link) return <Link to={link} className={btnGhost()}>Open in editor →</Link>;
  return <button onClick={run} className={btnGhost()}>Create entry from this</button>;
}
