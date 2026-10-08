import { useEffect, useState } from "react";
import { adminOverview } from "../../api";
import type { OverviewStats } from "../../types";
import { Card, Loading, ErrorBox } from "../../components/admin/ui";

function Stat({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold text-gray-100 ${accent}`}>{value}</p>
    </Card>
  );
}

function DailyChart({ daily }: { daily: OverviewStats["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.queries));
  return (
    <Card>
      <h2 className="text-sm font-semibold text-gray-200">Queries vs failures (14 days)</h2>
      <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label="Daily queries and failures chart">
        {daily.map((d) => (
          <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`${d.day}: ${d.queries} queries, ${d.failures} failed`}>
            <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
              <div className="w-full rounded-sm bg-red-500/70" style={{ height: `${(d.failures / max) * 100}%`, minHeight: d.failures ? 3 : 0 }} />
              <div className="w-full rounded-sm bg-orange-500/50" style={{ height: `${(d.queries / max) * 100}%`, minHeight: d.queries ? 3 : 0 }} />
            </div>
            <span className="text-[9px] text-gray-600">{d.day.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-orange-500/50" /> queries</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-500/70" /> failures</span>
      </div>
    </Card>
  );
}

export function AdminOverview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminOverview().then(setStats).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) return <ErrorBox text={error} onRetry={() => window.location.reload()} />;
  if (!stats) return <Loading />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-100">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total queries" value={String(stats.total_queries)} />
        <Stat label="Last 7 / 30 days" value={`${stats.queries_7d} / ${stats.queries_30d}`} />
        <Stat label="Failure rate (30d)" value={`${stats.failure_rate}%`} accent={stats.failure_rate > 20 ? "text-red-400" : ""} />
        <Stat label="Avg top score" value={stats.avg_top_score !== null ? String(stats.avg_top_score) : "-"} />
        <Stat label="Unresolved groups" value={String(stats.unresolved_groups)} accent={stats.unresolved_groups > 0 ? "text-amber-400" : ""} />
        <Stat label="Models live" value={`${stats.models_live} / ${stats.models_total}`} />
      </div>
      <DailyChart daily={stats.daily} />
    </div>
  );
}
