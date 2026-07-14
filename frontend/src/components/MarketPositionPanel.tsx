import type { MarketPosition } from "../types";

function formatZAR(n: number): string {
  return `R${n.toLocaleString("en-ZA")}`;
}

function ValueBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    "Budget Friendly": "bg-green-950/40 text-green-400 border-green-800",
    "Mid Range": "bg-blue-950/40 text-blue-400 border-blue-800",
    Premium: "bg-amber-950/40 text-amber-400 border-amber-800",
  };
  return (
    <span className={`rounded-lg border px-3 py-1 text-xs font-semibold ${styles[label] || "text-gray-400 border-gray-700"}`}>
      {label}
    </span>
  );
}

function PositionBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    "Below Average": "text-blue-400",
    "At Average": "text-green-400",
    "Above Average": "text-amber-400",
  };
  return <span className={`text-sm font-semibold ${styles[label] || "text-gray-400"}`}>{label}</span>;
}

export function MarketPositionPanel({ data, make, model }: { data: MarketPosition; make: string; model: string }) {
  const range = data.segment_high_mid_zar - data.segment_low_mid_zar;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Market Position</h2>
        <ValueBadge label={data.value_label} />
      </div>
      <p className="text-xs text-gray-600 mb-5">
        vs other {data.segment_label.toLowerCase()} &middot; {data.price_ranking}
      </p>

      <div className="relative mb-6">
        <div className="h-2 rounded-full bg-gradient-to-r from-green-600 via-blue-600 to-red-600" />
        {data.peers.map((peer) => {
          const pos = range > 0 ? ((peer.mid_zar - data.segment_low_mid_zar) / range) * 100 : 50;
          const isTarget = peer.make === make && peer.model === model;
          return (
            <div
              key={`${peer.make}-${peer.model}`}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `calc(${pos}% - ${isTarget ? 7 : 5}px)` }}
            >
              <div
                className={`rounded-full transition-all ${
                  isTarget
                    ? "h-3.5 w-3.5 bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.6)] ring-2 ring-orange-500/50"
                    : "h-2.5 w-2.5 bg-gray-300 ring-2 ring-gray-900"
                }`}
              />
              {isTarget && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[10px] font-semibold text-orange-400">
                    {formatZAR(data.target_mid_zar)}
                  </span>
                  <span className="text-[10px] text-orange-600 ml-1">&larr; target</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[11px] text-gray-600 mb-5">
        <span>{formatZAR(data.segment_low_mid_zar)}</span>
        <span>avg {formatZAR(data.segment_avg_mid_zar)}</span>
        <span>{formatZAR(data.segment_high_mid_zar)}</span>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <PositionBadge label={data.position_label} />
        <span className="text-xs text-gray-600">
          &middot; at {data.price_percentile.toFixed(0)}th percentile
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-800/50 text-gray-600">
              <th className="px-3 py-2 text-left font-medium">Model</th>
              <th className="px-3 py-2 text-right font-medium">Mid Price</th>
              <th className="px-3 py-2 text-right font-medium">Reliability</th>
            </tr>
          </thead>
          <tbody>
            {data.peers.map((peer, i) => {
              const isTarget = peer.make === make && peer.model === model;
              const midCol = peer.mid_zar <= data.segment_avg_mid_zar * 0.95 ? "text-green-400"
                : peer.mid_zar >= data.segment_avg_mid_zar * 1.05 ? "text-amber-400"
                : "text-blue-400";
              return (
                <tr
                  key={i}
                  className={`border-t border-gray-800 transition-colors ${
                    isTarget ? "bg-orange-500/5" : "hover:bg-gray-800/50"
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className={`font-medium ${isTarget ? "text-orange-400" : "text-gray-300"}`}>
                      {peer.make} {peer.model}
                    </span>
                    {isTarget && <span className="ml-1.5 text-[10px] text-orange-600">(this car)</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${midCol}`}>{formatZAR(peer.mid_zar)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{peer.reliability_score.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
