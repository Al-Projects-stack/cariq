import type { KnownFault } from "../types";

interface Props {
  faults: KnownFault[];
}

const SEVERITY_STYLES: Record<KnownFault["severity"], string> = {
  HIGH: "bg-red-900/60 text-red-300 border-red-700",
  MEDIUM: "bg-amber-900/60 text-amber-300 border-amber-700",
  LOW: "bg-green-900/60 text-green-300 border-green-700",
};

export function KnownFaultsPanel({ faults }: Props) {
  return (
    <div className="animate-fade-in rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-400">
        <WrenchIcon />
        Known Faults
      </h3>

      {faults.length === 0 ? (
        <p className="text-sm text-gray-500">No fault data returned for this query.</p>
      ) : (
        <ul className="space-y-4">
          {faults.map((fault, i) => (
            <li key={i} className="border-b border-gray-800 pb-4 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-gray-100 text-sm leading-snug">{fault.fault}</p>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[fault.severity]}`}
                >
                  {fault.severity}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                <span>{fault.mileage_range}</span>
                <span className="text-orange-400">{fault.estimated_repair_zar}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WrenchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
