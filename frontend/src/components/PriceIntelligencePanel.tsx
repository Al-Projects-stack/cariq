import type { PriceIntelligence } from "../types";

interface Props {
  data: PriceIntelligence;
}

const VERDICT_STYLES: Record<PriceIntelligence["verdict"], string> = {
  "GOOD DEAL": "bg-green-900/60 text-green-300 border-green-600",
  "FAIR": "bg-blue-900/60 text-blue-300 border-blue-600",
  "ABOVE MARKET": "bg-amber-900/60 text-amber-300 border-amber-600",
  "OVERPRICED": "bg-red-900/60 text-red-300 border-red-600",
};

function formatZAR(n: number): string {
  return `R${n.toLocaleString("en-ZA")}`;
}

export function PriceIntelligencePanel({ data }: Props) {
  const { price_range, verdict, verdict_label, model, year } = data;
  const range = price_range.high - price_range.low;
  const midPct = range > 0
    ? ((price_range.mid - price_range.low) / range) * 100
    : 50;

  return (
    <div className="animate-fade-in rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-400">
        <PriceIcon />
        Price Intelligence
      </h3>

      <p className="mb-4 text-xs text-gray-500">
        {year ? `${year} ` : ""}{model} · SA Market
      </p>

      <div className="mb-5 flex items-center justify-between text-xs text-gray-400">
        <span>{formatZAR(price_range.low)}</span>
        <span className="font-semibold text-gray-200">{formatZAR(price_range.mid)}</span>
        <span>{formatZAR(price_range.high)}</span>
      </div>

      <div className="relative mb-5 h-2 rounded-full bg-gray-800">
        <div
          className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-green-500 via-blue-500 to-red-500"
          style={{ width: "100%" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-white bg-gray-900 shadow"
          style={{ left: `calc(${midPct}% - 8px)` }}
        />
      </div>

      <div className={`rounded-lg border px-4 py-3 text-center ${VERDICT_STYLES[verdict]}`}>
        <p className="text-lg font-bold tracking-wide">{verdict}</p>
        <p className="mt-0.5 text-xs opacity-80">{verdict_label}</p>
      </div>
    </div>
  );
}

function PriceIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
