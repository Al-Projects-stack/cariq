import type { TCOEstimate } from "../types";

function formatZAR(n: number): string {
  return `R${n.toLocaleString("en-ZA")}`;
}

export function TCOPanel({ data }: { data: TCOEstimate }) {
  const pctFuel = (data.fuel_3yr / data.total_3yr) * 100;
  const pctInsurance = (data.insurance_3yr / data.total_3yr) * 100;
  const pctMaintenance = (data.maintenance_3yr / data.total_3yr) * 100;
  const pctPurchase = (data.purchase_price / data.total_3yr) * 100;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">3 Year Cost of Ownership</h2>
        <span className="text-xs text-gray-600">{data.fuel_type} &middot; {data.fuel_consumption_l_per_100km}L/100km &middot; {data.annual_km.toLocaleString()}km/yr</span>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <CostBox label="Purchase" value={formatZAR(data.purchase_price)} colour="text-blue-400" />
        <CostBox label="Fuel (3yr)" value={formatZAR(data.fuel_3yr)} colour="text-amber-400" />
        <CostBox label="Insurance (3yr)" value={formatZAR(data.insurance_3yr)} colour="text-red-400" />
        <CostBox label="Maintenance (3yr)" value={formatZAR(data.maintenance_3yr)} colour="text-green-400" />
      </div>

      <div className="h-3 rounded-full bg-gray-800 flex overflow-hidden mb-5">
        <div className="bg-blue-500 h-full" style={{ width: `${pctPurchase}%` }} title="Purchase" />
        <div className="bg-amber-500 h-full" style={{ width: `${pctFuel}%` }} title="Fuel" />
        <div className="bg-red-500 h-full" style={{ width: `${pctInsurance}%` }} title="Insurance" />
        <div className="bg-green-500 h-full" style={{ width: `${pctMaintenance}%` }} title="Maintenance" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Total over 3 years</p>
          <p className="text-2xl font-extrabold text-gray-100">{formatZAR(data.total_3yr)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Per month</p>
          <p className="text-xl font-bold text-orange-400">{formatZAR(data.monthly)}/mo</p>
        </div>
      </div>
    </div>
  );
}

function CostBox({ label, value, colour }: { label: string; value: string; colour: string }) {
  return (
    <div className="rounded-lg bg-gray-800/50 px-3 py-2.5">
      <p className="text-[11px] text-gray-600 mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${colour}`}>{value}</p>
    </div>
  );
}
