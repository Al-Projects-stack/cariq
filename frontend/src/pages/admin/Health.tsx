import { useCallback, useEffect, useState } from "react";
import { adminSyncHealth, adminListJobs, adminGetJob, adminReindexAll } from "../../api";
import type { SyncJob } from "../../types";
import { Card, Loading, ErrorBox, Toasts, useToasts, btnPrimary, btnGhost } from "../../components/admin/ui";
import { useAdmin } from "../../contexts/AdminContext";

interface HealthData {
  total_vectors: number;
  models: { slug: string; expected: number; found: number; ok: boolean }[];
}

export function AdminHealth() {
  const { admin } = useAdmin();
  const { toasts, notify } = useToasts();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmReindex, setConfirmReindex] = useState(false);
  const isAdmin = admin?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, j] = await Promise.all([adminSyncHealth(), adminListJobs("", 1)]);
      setHealth(h);
      setJobs(j.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function reindex() {
    try {
      const { job_id } = await adminReindexAll();
      notify("ok", `Reindex queued (job ${job_id})`);
      setConfirmReindex(false);
      const poll = async () => {
        try {
          const job = await adminGetJob(job_id);
          if (job.status === "done") {
            notify("ok", "Reindex complete");
            load();
          } else if (job.status === "failed") {
            notify("err", `Reindex failed: ${job.error || "unknown"}`);
            load();
          } else {
            setTimeout(poll, 3000);
          }
        } catch (e) {
          notify("err", e instanceof Error ? e.message : "Job poll failed");
        }
      };
      setTimeout(poll, 2500);
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Reindex failed");
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  const mismatched = (health?.models || []).filter((m) => !m.ok);

  return (
    <div className="space-y-4">
      <Toasts toasts={toasts} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-100">System Health</h1>
        {isAdmin && (
          confirmReindex ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/40 px-4 py-2">
              <span className="text-xs text-red-300">Re-embed every live model? This takes a while.</span>
              <button onClick={reindex} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500">Confirm</button>
              <button onClick={() => setConfirmReindex(false)} className="text-xs text-gray-400 hover:text-gray-200">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmReindex(true)} className={btnGhost()}>Reindex all</button>
          )
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-500">Pinecone vectors</p>
          <p className="mt-1 text-2xl font-bold text-gray-100">{health?.total_vectors ?? "-"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-500">Models in sync</p>
          <p className="mt-1 text-2xl font-bold text-gray-100">
            {(health?.models || []).filter((m) => m.ok).length} / {(health?.models || []).length}
          </p>
        </Card>
      </div>

      {mismatched.length > 0 && (
        <ErrorBox text={`${mismatched.length} model(s) differ between DB and Pinecone: ${mismatched.map((m) => `${m.slug} (${m.found}/${m.expected})`).join(", ")}`} />
      )}

      <Card className="!p-0 overflow-hidden">
        <h2 className="px-4 pt-4 text-sm font-semibold text-gray-200">Recent sync jobs</h2>
        {jobs.length === 0 ? <p className="px-4 py-4 text-sm text-gray-500">No jobs yet.</p> : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-y border-gray-800 text-left text-xs uppercase tracking-widest text-gray-500">
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">By</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-gray-800/50 last:border-0">
                  <td className="px-4 py-2 text-gray-400">#{j.id} {j.kind}</td>
                  <td className="px-4 py-2 text-gray-300">{j.model_slug || "-"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${j.status === "done" ? "bg-green-500/15 text-green-300" : j.status === "failed" ? "bg-red-500/15 text-red-300" : "bg-blue-500/15 text-blue-300"}`}>
                      {j.status}
                    </span>
                    {j.error && <span className="block truncate text-xs text-red-400" title={j.error}>{j.error}</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{j.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <button onClick={load} className={btnPrimary()}>Refresh</button>
    </div>
  );
}
